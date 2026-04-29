import { SignIn } from "@clerk/react";
import { Sparkles } from "lucide-react";
import { Link } from "wouter";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-pink-500/10 via-background to-fuchsia-500/10">
      <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary mb-8">
        <Sparkles className="w-5 h-5" />
        ConnectSphere
      </Link>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/discover"
        appearance={{
          variables: {
            colorPrimary: "hsl(263 70% 58%)",
            borderRadius: "0.75rem",
          },
        }}
      />
    </div>
  );
}
