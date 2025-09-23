import React from "react";
import {
  Host,
  Form,
  Section,
  Text,
  Button,
  HStack,
  VStack,
  Image,
  Spacer,
  Switch,
  NavigationStack,
  NavigationLink,
} from "@expo/ui/swift-ui";
import { background, clipShape, frame } from "@expo/ui/swift-ui/modifiers";

export default function NativeSettingsView({
  settings,
  onNameSettingChange,
  onSignOut,
  user,
  profile,
}) {
  return (
    <Host style={{ flex: 1 }}>
      <NavigationStack>
        <Form>
          {/* User Profile Section */}
          {user && (
            <Section>
              <HStack spacing={12}>
                <Image
                  systemName="person.crop.circle.fill"
                  size={50}
                  color="#A13333"
                />
                <VStack alignment="leading" spacing={4}>
                  <Text size={18} weight="semibold">
                    {profile?.name_ar || "مستخدم جديد"}
                  </Text>
                  <Text size={14} color="secondary">
                    {user?.phone || user?.email || ""}
                  </Text>
                </VStack>
                <Spacer />
              </HStack>

              <Button onPress={onSignOut} variant="destructive">
                <HStack>
                  <Image
                    systemName="rectangle.portrait.and.arrow.right"
                    size={18}
                  />
                  <Text>تسجيل الخروج</Text>
                </HStack>
              </Button>
            </Section>
          )}

          {/* Date Display Settings */}
          <Section title="عرض التاريخ">
            <NavigationLink destination="dateSettings">
              <HStack>
                <Image
                  systemName="calendar.badge.clock"
                  color="#A13333"
                  size={22}
                  modifiers={[
                    frame({ width: 28, height: 28 }),
                    background("#A1333320"),
                    clipShape("roundedRectangle"),
                  ]}
                />
                <Text>تنسيق التاريخ</Text>
                <Spacer />
                <Text color="secondary">
                  {settings.dateDisplay === "hijri"
                    ? "هجري"
                    : settings.dateDisplay === "gregorian"
                      ? "ميلادي"
                      : "كلاهما"}
                </Text>
                <Image systemName="chevron.right" size={14} color="secondary" />
              </HStack>
            </NavigationLink>
          </Section>

          {/* Names Display Settings */}
          <Section title="عرض الأسماء">
            <HStack>
              <Image
                systemName="globe"
                color="#A13333"
                size={22}
                modifiers={[
                  frame({ width: 28, height: 28 }),
                  background("#A1333320"),
                  clipShape("roundedRectangle"),
                ]}
              />
              <Text>إظهار الأسماء الإنجليزية</Text>
              <Spacer />
              <Switch
                value={settings.showEnglishNames}
                onValueChange={onNameSettingChange}
              />
            </HStack>
          </Section>

          {/* App Information */}
          <Section>
            <HStack>
              <Text color="secondary" size={13}>
                الإصدار
              </Text>
              <Spacer />
              <Text color="secondary" size={13}>
                2.0.0
              </Text>
            </HStack>
            <HStack>
              <Text color="secondary" size={13}>
                Build
              </Text>
              <Spacer />
              <Text color="secondary" size={13}>
                23
              </Text>
            </HStack>
          </Section>
        </Form>
      </NavigationStack>
    </Host>
  );
}
