import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { env } from "process";
import { EmailClient } from "@azure/communication-email";
import { db } from "./db";
import * as schema from "@/db/schema";
import { loginHistory } from "@/db/schema";
import { getRequiredEnv } from "./environment";
import { createId } from "./utils";
import { isAllowedDomain } from "./allowed-domains";

// Initialize Azure Email Client with required connection string
const azureEmailClient = new EmailClient(getRequiredEnv("AZURE_CONNECTION_STRING"));

function assertAllowedDomain(email: string) {
  if (!isAllowedDomain(email)) {
    throw new APIError("UNPROCESSABLE_ENTITY", {
      message: "Sorry, you do not have an authorized email domain. Please email to request access.",
    });
  }
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days (in seconds)
    updateAge: 60 * 60 * 24, // refresh session token every 24h
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          assertAllowedDomain(user.email);
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          // Record login event in permanent history
          try {
            await db.insert(loginHistory).values({
              id: createId(),
              userId: session.userId,
              ipAddress: session.ipAddress || "unknown",
              userAgent: session.userAgent || null,
              event: "login",
            });
          } catch (error) {
            console.error("[loginHistory] Failed to record login:", error);
          }
        },
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const message = {
        senderAddress: getRequiredEnv("AZURE_SENDER_EMAIL"),
        content: {
          subject: "Verify your email address",
          plainText: `Please verify your email by clicking this link: ${url}`,
          html: `
						<html>
							<body>
								<h1>Verify your email</h1>
								<p>Click the link below to verify your email address:</p>
								<a href="${url}">Verify my email</a>
								<br/><br/>
								<p>Or copy and paste this link into your browser: ${url}</p>
							</body>
						</html>
					`,
        },
        recipients: {
          to: [{ address: user.email }],
        },
      };

      try {
        const poller = await azureEmailClient.beginSend(message);
        await poller.pollUntilDone();
        console.log(`Verification email sent to ${user.email}`);
      } catch (error) {
        console.error("Failed to send verification email via Azure:", error);
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    async beforeSignIn(user: { email: string }) {
      assertAllowedDomain(user.email);
    },
  },
  account: {},
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      account: schema.accounts,
      session: schema.sessions,
      verification: schema.verifications,
      twoFactor: schema.twoFactors,
    },
  }),
  plugins: [
    twoFactor({
      issuer: "Clio",
      skipVerificationOnEnable: false,
    }),
  ],
});
