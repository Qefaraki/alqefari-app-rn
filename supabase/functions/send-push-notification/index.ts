import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Expo push notification API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface NotificationPayload {
  userId?: string
  userIds?: string[]
  title: string
  body: string
  data?: Record<string, any>
  priority?: 'default' | 'normal' | 'high'
  sound?: string | null
  badge?: number
  categoryId?: string
}

interface ExpoPushMessage {
  to: string | string[]
  sound: string | null
  title?: string
  body?: string
  data?: Record<string, any>
  priority?: 'default' | 'normal' | 'high'
  badge?: number
  categoryIdentifier?: string
  channelId?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload: NotificationPayload = await req.json()
    const { userId, userIds, title, body, data, priority = 'high', sound = 'default', badge, categoryId } = payload

    // Get target user IDs
    const targetUserIds = userIds || (userId ? [userId] : [])

    if (targetUserIds.length === 0) {
      throw new Error('No user IDs provided')
    }

    console.log(`Sending push notifications to ${targetUserIds.length} users`)

    // Get push tokens for all target users
    const { data: pushTokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', targetUserIds)
      .eq('is_active', true)

    if (tokenError) {
      console.error('Error fetching push tokens:', tokenError)
      throw tokenError
    }

    if (!pushTokens || pushTokens.length === 0) {
      console.log('No active push tokens found for users')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active push tokens found',
          sent: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    console.log(`Found ${pushTokens.length} active push tokens`)

    // Prepare Expo push messages (batch up to 100)
    const messages: ExpoPushMessage[] = []
    const batches: ExpoPushMessage[][] = []

    for (const { token, user_id } of pushTokens) {
      // Skip invalid Expo push tokens
      if (!token.startsWith('ExponentPushToken[') || !token.endsWith(']')) {
        console.warn(`Invalid Expo push token format for user ${user_id}: ${token}`)
        continue
      }

      const message: ExpoPushMessage = {
        to: token,
        sound: sound,
        title: title,
        body: body,
        data: {
          ...data,
          userId: user_id,
          timestamp: new Date().toISOString()
        },
        priority: priority,
        channelId: 'default' // Android channel
      }

      if (badge !== undefined) {
        message.badge = badge
      }

      if (categoryId) {
        message.categoryIdentifier = categoryId
      }

      messages.push(message)

      // Batch messages (Expo allows max 100 per request)
      if (messages.length === 100) {
        batches.push([...messages])
        messages.length = 0
      }
    }

    // Add remaining messages to batches
    if (messages.length > 0) {
      batches.push(messages)
    }

    if (batches.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No valid push tokens to send',
          sent: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Send push notifications in batches
    const results = []
    let totalSent = 0
    let totalErrors = 0

    for (const batch of batches) {
      try {
        console.log(`Sending batch of ${batch.length} notifications`)

        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate'
          },
          body: JSON.stringify(batch)
        })

        const result = await response.json()
        results.push(result)

        // Process Expo response
        if (result.data) {
          for (let i = 0; i < result.data.length; i++) {
            const ticket = result.data[i]
            const message = batch[i]
            const userId = message.data?.userId

            if (ticket.status === 'ok') {
              totalSent++

              // Update notification record to mark push as sent
              await supabase
                .from('notifications')
                .update({
                  push_sent: true,
                  push_sent_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .is('push_sent', false)
                .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Last minute
            } else if (ticket.status === 'error') {
              totalErrors++
              console.error(`Push notification error for user ${userId}:`, ticket.message)

              // Mark token as inactive if it's invalid
              if (ticket.details?.error === 'DeviceNotRegistered') {
                await supabase
                  .from('push_tokens')
                  .update({ is_active: false })
                  .eq('token', message.to)
              }

              // Log error in notifications table
              await supabase
                .from('notifications')
                .update({
                  push_error: ticket.message || 'Failed to send push notification'
                })
                .eq('user_id', userId)
                .is('push_sent', false)
                .gte('created_at', new Date(Date.now() - 60000).toISOString())
            }
          }
        }

        // Add delay between batches to avoid rate limiting
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

      } catch (error) {
        console.error('Error sending batch:', error)
        totalErrors += batch.length
      }
    }

    // Update last_used timestamp for successful tokens
    if (totalSent > 0) {
      await supabase
        .from('push_tokens')
        .update({ last_used: new Date().toISOString() })
        .in('token', pushTokens.filter(t => t.token.startsWith('ExponentPushToken[')).map(t => t.token))
    }

    console.log(`Push notification summary: ${totalSent} sent, ${totalErrors} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        errors: totalErrors,
        results: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})