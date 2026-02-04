"use client";
import { useState, useEffect } from "react";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

import { useRouter } from "next/navigation";

import { authClient } from "@/src/lib/auth-client";
import { Alert, AlertDescription } from "../ui/alert";
import { Mail, Terminal, CheckCircle2 } from "lucide-react";

import { IconLoader } from "@tabler/icons-react";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();

  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [userId, setUserId] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  // Polling logic for email verification
  useEffect(() => {
    if (!isSent || !userId || isVerified) return;

    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout;

    const checkStatus = async () => {
      // We check the session to see if the user is now verified
      const { data: session } = await authClient.getSession();
      
      if (session?.user?.emailVerified) {
        setIsVerified(true);
        return;
      }

      const elapsed = Date.now() - startTime;
      const oneHour = 60 * 60 * 1000;
      const fourHours = 4 * oneHour;

      if (elapsed >= fourHours) {
        return; // Stop polling after 4 hours total
      }

      // 4 seconds for the first hour, 60 seconds (1 minute) after that
      const delay = elapsed < oneHour ? 4000 : 60000;
      timeoutId = setTimeout(checkStatus, delay);
    };

    // Start the first check
    timeoutId = setTimeout(checkStatus, 4000);

    return () => clearTimeout(timeoutId);
  }, [isSent, userId, isVerified]);

  async function handleSubmit(e: any) {
    e.preventDefault();

    const { data, error } = await authClient.signUp.email(
      {
        email,
        password,
        name: fullname,
      },
      {
        onRequest: (ctx) => {
          setLoading(true);
        },
        onSuccess: (ctx) => {
          console.log("\n\nctx", ctx);
          setLoading(false);
          setIsSent(true);
          setUserId(ctx.data.user.id);
        },
        onError: (ctx) => {
          setError(ctx.error.message);
          setLoading(false);
        },
      }
    );
  }

  if (isSent) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={cn(
                "p-3 rounded-full",
                isVerified ? "bg-green-100" : "bg-blue-100"
              )}>
                {isVerified ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <Mail className="h-6 w-6 text-blue-600" />
                )}
              </div>
            </div>
            <CardTitle>
              {isVerified ? "Thanks For Verifying" : "Check your email"}
            </CardTitle>
            <CardDescription>
              {isVerified 
                ? "Your email has been successfully verified."
                : <>We've sent a verification link to <span className="font-semibold text-foreground">{email}</span>.</>
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground text-center">
              {isVerified 
                ? "You can now access all features of your dashboard."
                : "Please click the link in the email to verify your account. Once verified, this page will update automatically."
              }
            </p>
            <Button 
              variant={isVerified ? "default" : "outline"} 
              className="w-full" 
              onClick={() => router.push(isVerified ? "/dashboard" : "/login")}
            >
              {isVerified ? "Continue to Dashboard" : "Back to Login"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Get started with your new account</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border border-red-500" variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={(e) => handleSubmit(e)}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  onChange={(e) => setFullname(e.target.value)}
                  value={fullname}
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  onChange={(e) => setEmail(e.target.value)}
                  value={email}
                  id="email"
                  type="email"
                  placeholder="me@example.com"
                  required
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  onChange={(e) => setPassword(e.target.value)}
                  value={password}
                  id="password"
                  type="password"
                  required
                />
              </div>
              <div className="flex flex-col gap-3">
                <Button disabled={loading} type="submit" className="w-full">
                  {loading ? (
                    <IconLoader className="animate-spin" stroke={2} />
                  ) : (
                    "Sign Up"
                  )}
                </Button>
              </div>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <a href="/login" className="underline underline-offset-4">
                Login
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
