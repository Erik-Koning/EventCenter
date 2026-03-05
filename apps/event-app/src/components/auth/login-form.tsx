"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

import { IconLoader } from "@tabler/icons-react";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: any) {
    e.preventDefault();

    const email = username + "@scotiabank.com";
    const { data, error } = await authClient.signIn.email(
      {
        email,
        password,
        callbackURL: "/agenda",
        rememberMe: false,
      },
      {
        onRequest: (ctx) => {
          setLoading(true);
        },
        onSuccess: () => {
          router.push("/agenda");
        },
        onError: (ctx) => {
          // Better Auth returns a specific error for 2FA-required accounts
          if (
            ctx.error.status === 302 ||
            ctx.error.message?.includes("two-factor")
          ) {
            router.push("/auth/two-factor");
            return;
          }
          setError(ctx.error.message);
          setLoading(false);
        },
      }
    );
  }

  return (
    <div className={cn("flex flex-col gap-6 w-full", className)} {...props}>
      <div className="grid gap-1.5">
        <h2 className="text-lg font-semibold leading-none">Login</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email below to login to your account
        </p>
      </div>
      {error && (
        <Alert className="border border-red-500" variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={(e) => handleSubmit(e)}>
        <div className="flex flex-col gap-6">
          <div className="grid gap-3">
            <Label htmlFor="username">Email</Label>
            <div className="flex h-9 w-full items-center overflow-hidden rounded-md border border-input bg-background shadow-xs focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500/50">
              <input
                onChange={(e) => {
                  const v = e.target.value;
                  setUsername(v.includes("@") ? v.split("@")[0] : v);
                }}
                value={username}
                id="username"
                type="text"
                placeholder="john.doe"
                required
                className="min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground md:text-sm"
              />
              <span className="flex-shrink-0 select-none border-l border-input bg-muted px-2.5 text-xs text-muted-foreground h-full flex items-center">
                @scotiabank.com
              </span>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center">
              <Label htmlFor="password">Password</Label>
              <a
                href="/forgot-password"
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
              className="bg-white focus-visible:border-red-500 focus-visible:ring-red-500/50"
            />
          </div>
          <div className="flex flex-col gap-3">
            <Button disabled={loading} type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white">
              {loading ? (
                <IconLoader className="animate-spin" stroke={2} />
              ) : (
                "Login"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
