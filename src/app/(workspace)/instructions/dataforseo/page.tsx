import { InstructionPage } from "@/components/instruction-page";

export default function InstructionsDataForSeoPage() {
  return (
    <InstructionPage
      badge="Instructions DataForSEO"
      title="Create and save DataForSEO API credentials."
      subtitle="Use these steps to restore the original DataForSEO workflow in the new app."
      sections={[
        {
          title: "Get credentials",
          bullets: [
            "Create or sign in to your DataForSEO account.",
            "Copy the API login and password from the account credentials area.",
          ],
        },
        {
          title: "Connect in the app",
          bullets: [
            "Open Settings and paste the username and password into the DataForSEO fields.",
            "Save the SERP settings and choose DataForSEO as default if that is your primary provider.",
          ],
        },
      ]}
    />
  );
}
