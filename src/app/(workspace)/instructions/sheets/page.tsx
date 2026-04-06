import { InstructionPage } from "@/components/instruction-page";

export default function InstructionsSheetsPage() {
  return (
    <InstructionPage
      badge="Instructions Sheets"
      title="Set up Google Sheets access for exports and project sheets."
      subtitle="The new app supports both OAuth and service account mode, like the original version."
      sections={[
        {
          title: "Enable APIs",
          bullets: [
            "Enable Google Sheets API and Google Drive API in the same Google Cloud project.",
            "Reuse the same OAuth client if you want both Search Console and Sheets in one place.",
          ],
        },
        {
          title: "OAuth flow",
          bullets: [
            "Add the callback URL /api/google/sheets/callback to your web OAuth client.",
            "Upload the OAuth client JSON in Settings and connect Google Sheets.",
          ],
        },
        {
          title: "Service account mode",
          bullets: [
            "Create a service account if you prefer automated access without personal OAuth.",
            "Upload the service account JSON in Settings.",
            "Share any sheet or drive location with the service account email when needed.",
          ],
        },
      ]}
    />
  );
}
