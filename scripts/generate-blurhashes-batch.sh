#!/bin/bash

# Batch BlurHash Generation Script
# Purpose: Generate blurhashes for all existing profile photos
#
# This script calls the Supabase Edge Function for each profile that needs a blurhash

PROJECT_URL="https://ezkioroyhzpavmbfavyn.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2lvcm95aHpwYXZtYmZhdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTI2MjAsImV4cCI6MjA3MjA2ODYyMH0.-9bUFjeXEwAcdl1d8fj7dX1ZmHMCpuX5TdzmFTOwO-Q"
FUNCTION_URL="$PROJECT_URL/functions/v1/generate-blurhash"

SUCCESS_COUNT=0
FAILED_COUNT=0

echo "🚀 Starting batch blurhash generation..."
echo "---"

# Profile data (68 profiles with photos that need blurhash)
# Format: profileId|photoUrl

PROFILES=(
  "fe67b801-e72e-4731-a4db-2637134ba1e9|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/fe67b801-e72e-4731-a4db-2637134ba1e9/photo_1760566294942_27klgf.jpg"
  "3ef34fc3-5c6e-41d2-8023-238eca609906|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/3ef34fc3-5c6e-41d2-8023-238eca609906/photo_1760862071569_uvcymm.jpg"
  "c2afd0f7-ec4c-465e-aa37-cedb111a8183|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/c2afd0f7-ec4c-465e-aa37-cedb111a8183/photo_1761032850995_6q0n3.jpg"
  "b7244a7b-ba9a-42f4-8668-a3d14516470c|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/b7244a7b-ba9a-42f4-8668-a3d14516470c/photo_1760633004261_186jju.jpg"
  "d3c4a7cc-c6b4-4874-af6d-3afe70b0c3e4|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/d3c4a7cc-c6b4-4874-af6d-3afe70b0c3e4/photo_1761545293428_yt1khb.jpg"
  "10804146-c7d0-49aa-8c5f-34db40150e3f|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/10804146-c7d0-49aa-8c5f-34db40150e3f/photo_1760627124545_s56qmn.jpg"
  "27b94944-e478-4d0c-87bb-7aefc89e5ca6|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/27b94944-e478-4d0c-87bb-7aefc89e5ca6/photo_1760743229419_dxxf1.jpg"
  "d81b4d0c-ce3d-47e3-8cea-3ae20512cb3e|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/d81b4d0c-ce3d-47e3-8cea-3ae20512cb3e/photo_1761081263890_bzybia.jpg"
  "9a99b73a-4be2-4857-bbb5-b34b5d916236|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/9a99b73a-4be2-4857-bbb5-b34b5d916236/photo_1761032676232_myyt2.jpg"
  "a5279a51-1c42-4562-8bcb-d4b2ff8fb5be|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/a5279a51-1c42-4562-8bcb-d4b2ff8fb5be/photo_1760565831233_bgt6z.jpg"
  "0eef6804-ee1e-4f0c-a020-9aa31a1f1786|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/0eef6804-ee1e-4f0c-a020-9aa31a1f1786/photo_1760716012408_vdf0f.jpg"
  "6e678781-26b5-4b84-a24b-2fe987cab4f7|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/6e678781-26b5-4b84-a24b-2fe987cab4f7/photo_1761068366387_6ueraq.jpg"
  "e6d7816c-287d-4f9f-bbac-ba1a2e3a347f|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/e6d7816c-287d-4f9f-bbac-ba1a2e3a347f/photo_1761548588677_xka8gb.jpg"
  "3ba57e8d-fa2a-4129-a06f-bd00fdcc7dd0|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/3ba57e8d-fa2a-4129-a06f-bd00fdcc7dd0/photo_1760716140948_viobkc.jpg"
  "5853ff0a-c2c0-4ead-9210-9bb999584419|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/5853ff0a-c2c0-4ead-9210-9bb999584419/photo_1760830388171_ydpou6.jpg"
  "11e21459-0b45-4cec-aba8-5a7c47232e20|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/11e21459-0b45-4cec-aba8-5a7c47232e20/photo_1761557403093_yhzige.jpg"
  "5e845aa4-6a0b-4eaa-8d95-12ee5127b249|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/5e845aa4-6a0b-4eaa-8d95-12ee5127b249/photo_1760861897527_ks58k.jpg"
  "4e422026-2f10-4040-87d9-409f3c25f346|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/4e422026-2f10-4040-87d9-409f3c25f346/photo_1761068400459_7r3388.jpg"
  "d652d919-efd7-4451-b74c-6e18addfe584|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/d652d919-efd7-4451-b74c-6e18addfe584/photo_1760829838375_lh0v3q.jpg"
  "28107c92-9989-4531-b54d-14475ae372ee|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/28107c92-9989-4531-b54d-14475ae372ee/photo_1760746658356_xarvc.jpg"
  "07bdadf6-1270-4046-b89e-51d76173e734|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/07bdadf6-1270-4046-b89e-51d76173e734/photo_1760743744160_go8q.jpg"
  "fd9a486c-5299-4420-9f14-e994e3b7d832|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/fd9a486c-5299-4420-9f14-e994e3b7d832/photo_1760748014103_ukrtc.jpg"
  "a892f2dc-d60a-42a1-a032-41e2dd85eac1|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/a892f2dc-d60a-42a1-a032-41e2dd85eac1/photo_1761545010145_pwss1p.jpg"
  "4421143d-8044-4983-8f9e-cad481fd062c|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/4421143d-8044-4983-8f9e-cad481fd062c/photo_1760743569191_a3pv1a.jpg"
  "fe6a1a39-c198-4964-9815-701c3d2b008e|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/fe6a1a39-c198-4964-9815-701c3d2b008e/photo_1760565743818_gwqbi.jpg"
  "b8f24775-e147-4020-8198-da0e3f4892b8|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/b8f24775-e147-4020-8198-da0e3f4892b8/photo_1760653124507_or2h7a.jpg"
  "08cdf269-56c2-48f5-bdcc-521b8f63451a|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/08cdf269-56c2-48f5-bdcc-521b8f63451a/photo_1760830224445_dlpgz.jpg"
  "a550662f-3842-488c-954a-439948e500b6|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/a550662f-3842-488c-954a-439948e500b6/photo_1761079158185_4tsjxd.jpg"
  "b0a9c9cf-1f30-415e-87cf-12147cafd97d|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/b0a9c9cf-1f30-415e-87cf-12147cafd97d/photo_1761080919122_u7ij0o.jpg"
  "bfa39077-26db-425c-a222-f37f27449f44|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/bfa39077-26db-425c-a222-f37f27449f44/photo_1760830256047_sw71ik.jpg"
  "879907d0-6003-4af5-b2a9-2af02667a2c6|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/879907d0-6003-4af5-b2a9-2af02667a2c6/photo_1760743483754_zqeeyn.jpg"
  "588ddb58-0ea0-498c-b1aa-8c75a0aabbb3|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/588ddb58-0ea0-498c-b1aa-8c75a0aabbb3/photo_1761017003298_8pki1.jpg"
  "c914406f-af76-4448-ae40-113d055b4eec|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/c914406f-af76-4448-ae40-113d055b4eec/photo_1761068703301_xrzbyu.jpg"
  "438cc048-cc5c-4009-bdf1-221c2f20aba8|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/438cc048-cc5c-4009-bdf1-221c2f20aba8/photo_1760747483474_s760nv.jpg"
  "ca5a14d9-72f5-4ca9-aee2-20f3d6834a55|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/ca5a14d9-72f5-4ca9-aee2-20f3d6834a55/photo_1760747691537_v4iim.jpg"
  "233bd290-ec1e-4a61-a67f-4206ccd73de9|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/233bd290-ec1e-4a61-a67f-4206ccd73de9/photo_1760743494694_vqsgae.jpg"
  "12c78536-8f86-464d-9179-a45845bf8e19|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/12c78536-8f86-464d-9179-a45845bf8e19/photo_1761017080734_a221c8.jpg"
  "f9a81e80-a482-4cad-ab9b-796eb828afe8|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/f9a81e80-a482-4cad-ab9b-796eb828afe8/photo_1760743291629_kigp5s.jpg"
  "9156fb8a-c8bf-4c8b-9433-81b26258ebf5|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/9156fb8a-c8bf-4c8b-9433-81b26258ebf5/photo_1760830517478_r56cii.jpg"
  "7f2c1ef3-fb76-4d28-8d10-bfb1251a84e7|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/7f2c1ef3-fb76-4d28-8d10-bfb1251a84e7/photo_1761169720855_v855bz.jpg"
  "2a8fe3b6-821e-4c96-a533-db3eb26ef641|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/2a8fe3b6-821e-4c96-a533-db3eb26ef641/photo_1760747632399_zewdjm.jpg"
  "996bee1b-3b07-44fd-bc2f-b51362800d02|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/996bee1b-3b07-44fd-bc2f-b51362800d02/photo_1761553033744_r5n3iw.jpg"
  "c05e9485-68f6-4731-8c50-4e1da36f5d1d|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/c05e9485-68f6-4731-8c50-4e1da36f5d1d/photo_1760746938217_v8vtp.jpg"
  "2606cbf1-5a5c-49b8-adc0-303eaa3e84cb|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/2606cbf1-5a5c-49b8-adc0-303eaa3e84cb/photo_1761557045000_uf4qbu.jpg"
  "19e6c132-3438-447f-b99a-4bed21777ddd|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/19e6c132-3438-447f-b99a-4bed21777ddd/photo_1761332507850_xm52da.jpg"
  "11f88a55-a933-4c85-9c05-ee4de362c6d3|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/11f88a55-a933-4c85-9c05-ee4de362c6d3/photo_1761123463540_5x9gms.jpg"
  "423531a8-ed76-44cd-aca4-16a7ba680daf|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/423531a8-ed76-44cd-aca4-16a7ba680daf/photo_1760743360788_bgta6l.jpg"
  "3510f1f2-8f5f-4890-8ddf-f32164b32ff5|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/3510f1f2-8f5f-4890-8ddf-f32164b32ff5/photo_1761068536655_y0g8jm.jpg"
  "fb4fc94a-93a6-4a85-bcb0-7ec86e72eed9|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/fb4fc94a-93a6-4a85-bcb0-7ec86e72eed9/photo_1761079123913_d242p.jpg"
  "ae42a98c-9874-4c99-9387-4b2a66198dcb|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/ae42a98c-9874-4c99-9387-4b2a66198dcb/photo_1760743897580_v7u11a.jpg"
  "bb1749f4-199f-4659-b2c3-033424ad3da9|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/bb1749f4-199f-4659-b2c3-033424ad3da9/photo_1761078906899_ry8m7i.jpg"
  "7ab01d1f-c4f2-47bb-b3b3-1927915b3945|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/7ab01d1f-c4f2-47bb-b3b3-1927915b3945/photo_1761068579540_727hq7.jpg"
  "be3dbdf8-80e6-4da9-bffb-1f0992124415|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/be3dbdf8-80e6-4da9-bffb-1f0992124415/photo_1761033401770_xi5u6t.jpg"
  "55e07dce-2f6f-4594-bf69-de492bee958d|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/55e07dce-2f6f-4594-bf69-de492bee958d/photo_1760747185988_23sb5.jpg"
  "ec304ed0-bf83-4c9b-96f9-a47ddabfbe17|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/ec304ed0-bf83-4c9b-96f9-a47ddabfbe17/photo_1760986583752_hrelro.jpg"
  "5fe61833-4abf-491d-9d72-c37971ab3424|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/5fe61833-4abf-491d-9d72-c37971ab3424/photo_1761080742125_23t34s.jpg"
  "36ad9c17-608c-4140-882e-987a73570f33|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/36ad9c17-608c-4140-882e-987a73570f33/photo_1761078953819_1bw27a.jpg"
  "f2c35345-ad94-4c25-ae02-23779370fed6|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/f2c35345-ad94-4c25-ae02-23779370fed6/photo_1761068436373_a8rxns.jpg"
  "650a01a4-879b-45e8-acec-d04aaaf91b7b|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/650a01a4-879b-45e8-acec-d04aaaf91b7b/photo_1760627032490_vjlwjpg.jpg"
  "d3bd2a45-9317-4498-8c5d-f1cc0738c822|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/d3bd2a45-9317-4498-8c5d-f1cc0738c822/photo_1760747023361_k8ady6.jpg"
  "742625ce-2e00-4999-8bc0-333127007dfe|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/742625ce-2e00-4999-8bc0-333127007dfe/photo_1761068729584_zjqsa9q.jpg"
  "3b523716-d9e8-4482-a7a5-7d7ea7f5f9dd|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/3b523716-d9e8-4482-a7a5-7d7ea7f5f9dd/photo_1761078982082_68o2as.jpg"
  "062067ee-182a-4cc6-8b34-21692a678477|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/062067ee-182a-4cc6-8b34-21692a678477/photo_1761033138085_tr9aje.jpg"
  "229da5be-1af8-483a-bb82-7df2e1f7deb2|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/229da5be-1af8-483a-bb82-7df2e1f7deb2/photo_1761068772787_xfbuhs.jpg"
  "54aa17ad-7f1f-43db-ba25-ff4c0c88183f|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/54aa17ad-7f1f-43db-ba25-ff4c0c88183f/photo_1761079007794_7dn8y.jpg"
  "d632bf1f-0f58-4b1f-84a4-19e55c97b983|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/d632bf1f-0f58-4b1f-84a4-19e55c97b983/photo_1761169674132_4x5yx6.jpg"
  "9c7d351d-e4b9-45a9-9200-a252df0851a3|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/9c7d351d-e4b9-45a9-9200-a252df0851a3/photo_1761079070179_te6jqk.jpg"
  "50b14907-ee6a-4aa3-a706-7b7f62e5669c|https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/profiles/50b14907-ee6a-4aa3-a706-7b7f62e5669c/photo_1760652702762_99gm5.jpg"
)

TOTAL=${#PROFILES[@]}

# Process profiles in batches of 5 for parallel execution
BATCH_SIZE=5
CURRENT=0

for profile in "${PROFILES[@]}"; do
  IFS='|' read -r PROFILE_ID PHOTO_URL <<< "$profile"

  ((CURRENT++))

  echo "[$CURRENT/$TOTAL] Processing profile $PROFILE_ID..."

  # Call Edge Function
  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"profileId\":\"$PROFILE_ID\",\"photoUrl\":\"$PHOTO_URL\"}")

  # Check if successful
  if echo "$RESPONSE" | grep -q '"success":true'; then
    BLURHASH=$(echo "$RESPONSE" | grep -o '"blurhash":"[^"]*"' | cut -d'"' -f4)
    echo "  ✅ Generated blurhash: $BLURHASH"
    ((SUCCESS_COUNT++))
  else
    ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "  ❌ Failed: $ERROR"
    ((FAILED_COUNT++))
  fi

  # Sleep between batches to avoid overwhelming the Edge Function
  if (( CURRENT % BATCH_SIZE == 0 )) && (( CURRENT < TOTAL )); then
    echo "  ⏸️  Pausing for 2 seconds..."
    sleep 2
  fi
done

echo "---"
echo "🎉 Batch generation complete!"
echo "  ✅ Success: $SUCCESS_COUNT"
echo "  ❌ Failed: $FAILED_COUNT"
echo "  📊 Total: $TOTAL"
