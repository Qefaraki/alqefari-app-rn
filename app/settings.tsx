import React from "react";
import SettingsPage from "../src/screens/SettingsPage";
import { SettingsProvider } from "../src/contexts/SettingsContext";

export default function SettingsScreen() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    // Get current user
    async function loadUser() {
      const {
        data: { user },
      } = await require("../src/services/supabase").supabase.auth.getUser();
      setUser(user);
    }
    loadUser();
  }, []);

  return (
    <SettingsProvider>
      <SettingsPage user={user} />
    </SettingsProvider>
  );
}
