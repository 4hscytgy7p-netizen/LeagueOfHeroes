export interface NotificationJob {
  id: string;
  channel: "discord" | "email";
  discord_id: string | null;
  email: string | null;
  title: string;
  message: string;
  card_id: string;
  workspace_id: string;
}
export interface SenderConfig {
  discordToken?: string;
  resendKey?: string;
  emailFrom?: string;
  siteUrl?: string;
}

export async function deliverNotification(
  job: NotificationJob,
  config: SenderConfig,
  send: typeof fetch = fetch,
): Promise<void> {
  if (!config.siteUrl) throw new Error("site_url_not_configured");
  const link = new URL("/test/cabinet/", config.siteUrl);
  if (link.protocol !== "https:" && link.protocol !== "http:")
    throw new Error("invalid_site_url");
  link.searchParams.set("workspace", job.workspace_id);
  link.searchParams.set("card", job.card_id);
  const text = `${job.title}\n\n${job.message}\n\n${link.href}`;
  const request = async (url: string, init: RequestInit) => {
    const response = await send(url, {
      ...init,
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
      throw new Error(`provider_${job.channel}_${response.status}`);
    return response;
  };
  if (job.channel === "discord") {
    if (!config.discordToken) throw new Error("discord_not_configured");
    if (!job.discord_id) throw new Error("discord_id_missing");
    const headers = {
      Authorization: `Bot ${config.discordToken}`,
      "Content-Type": "application/json",
    };
    const dm = await request("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers,
      body: JSON.stringify({ recipient_id: job.discord_id }),
    });
    const channel = await dm.json();
    if (!/^\d+$/.test(channel.id)) throw new Error("invalid_discord_channel");
    await request(
      `https://discord.com/api/v10/channels/${channel.id}/messages`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: text.slice(0, 2000),
          allowed_mentions: { parse: [] },
          nonce: job.id.replaceAll("-", "").slice(0, 25),
          enforce_nonce: true,
        }),
      },
    );
  } else {
    if (!config.resendKey || !config.emailFrom)
      throw new Error("email_not_configured");
    if (!job.email) throw new Error("verified_email_missing");
    await request("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": job.id,
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [job.email],
        subject: job.title,
        text,
      }),
    });
  }
}
