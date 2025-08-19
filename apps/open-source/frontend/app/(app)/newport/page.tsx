import { AppNewport } from "@/components/app-newport";

export default function NewportPage() {
  const appConfig = {
    pageTitle: "Newport Beach Vacation Properties",
    pageDescription: "Reservation confirmation with Pelican Petey",
    companyName: "Newport Beach Vacation Properties",
    startButtonText: "Start Newport Beach Call",
    supportsChatInput: true,
    supportsVideoInput: false,
    supportsScreenShare: false,
    isPreConnectBufferEnabled: true,
    logo: "/newport-logo.png",
  };

  return <AppNewport appConfig={appConfig} />;
}
