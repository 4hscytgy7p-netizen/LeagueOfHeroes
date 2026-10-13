// Worker is invoked by cron with a separate secret, never from the browser.
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { deliverNotification } from "./sender.ts";

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get("TEAM_CRON_SECRET");
  if (!secret || request.headers.get("x-team-cron-secret") !== secret)
    return new Response("Unauthorized", { status: 401 });
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: jobs, error } = await client.rpc("team_claim_notifications");
  if (error)
    return Response.json({ error: "queue_unavailable" }, { status: 500 });
  let sent = 0,
    failed = 0;
  for (const job of jobs || []) {
    let errorCode: string | null = null;
    try {
      // Recheck access/preferences immediately before contacting an external provider.
      const { data: notification, error: notificationError } = await client
        .from("team_notifications")
        .select("state,lease_id,recipient_id,reason")
        .eq("id", job.id)
        .single();
      if (notificationError) throw new Error("recipient_check_failed");
      if (
        !notification ||
        notification.state !== "sending" ||
        notification.lease_id !== job.lease_id
      )
        continue;
      const { data: liveCard, error: cardError } = await client
        .from("team_cards")
        .select("archived,completed,assignees")
        .eq("id", job.card_id)
        .single();
      const { data: member, error: memberError } = await client
        .from("team_members")
        .select("notify_discord,notify_email")
        .eq("workspace_id", job.workspace_id)
        .eq("user_id", notification.recipient_id)
        .maybeSingle();
      if (cardError || memberError) throw new Error("recipient_check_failed");
      if (
        !liveCard ||
        liveCard.archived ||
        !member ||
        !liveCard.assignees.includes(notification.recipient_id) ||
        (notification.reason === "reminder" && liveCard.completed) ||
        !member[job.channel === "discord" ? "notify_discord" : "notify_email"]
      ) {
        const result = await client
          .from("team_notifications")
          .update({ state: "cancelled", error_code: "recipient_unavailable" })
          .eq("id", job.id)
          .eq("lease_id", job.lease_id);
        if (result.error) throw new Error("queue_cancel_failed");
        continue;
      }
      await deliverNotification(job, {
        discordToken: Deno.env.get("TEAM_DISCORD_BOT_TOKEN"),
        resendKey: Deno.env.get("TEAM_RESEND_API_KEY"),
        emailFrom: Deno.env.get("TEAM_EMAIL_FROM"),
        siteUrl: Deno.env.get("TEAM_SITE_URL"),
      });
      sent++;
    } catch (error) {
      errorCode = error instanceof Error ? error.message : "delivery_failed";
      failed++;
    }
    const result = await client.rpc("team_finish_notification", {
      p_id: job.id,
      p_lease: job.lease_id,
      p_error: errorCode,
    });
    if (result.error)
      return Response.json(
        { error: "queue_ack_failed", sent, failed },
        { status: 500 },
      );
  }
  return Response.json({ sent, failed });
});
