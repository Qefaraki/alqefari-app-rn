import React from "react";
import SettingsPageModern from "../../src/screens/SettingsPageModern";

export default function SettingsScreen() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    // Get current user
    async function loadUser() {
      const {
        data: { user },
      } = await require("../../src/services/supabase").supabase.auth.getUser();
      setUser(user);
    }
    loadUser();
  }, []);

  // SettingsProvider is already provided at app root level (app/_layout.tsx)
  // No need to wrap here - this was creating a duplicate context instance
  // that prevented state updates from propagating to TreeView
  return <SettingsPageModern user={user} />;
}
