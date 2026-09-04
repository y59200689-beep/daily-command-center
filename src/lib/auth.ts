type SignOutClient = {
  auth: {
    signOut: (options: { scope: "local" }) => Promise<{ error: Error | null }>;
  };
};

export async function signOutCurrentSession(client: SignOutClient) {
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
}
