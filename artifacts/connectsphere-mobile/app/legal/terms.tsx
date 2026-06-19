import { LegalDocumentScreen } from "@/components/LegalDocumentScreen";
import { termsOfServiceDocument } from "@/lib/legalDocuments";

export default function TermsOfServiceScreen() {
  return <LegalDocumentScreen document={termsOfServiceDocument} />;
}
