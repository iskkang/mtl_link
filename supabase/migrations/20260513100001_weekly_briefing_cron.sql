-- Register weekly-briefing cron: every Monday 08:30 KST (UTC Sunday 23:30)
-- Requires pg_cron + pg_net extensions (already enabled via 20260430000000_extensions.sql)

SELECT cron.unschedule('mint-weekly-briefing') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'mint-weekly-briefing'
);

SELECT cron.schedule(
  'mint-weekly-briefing',
  '30 23 * * 0',
  $$
  SELECT net.http_post(
    url     := 'https://zidkckbabtajpgkhxmfm.supabase.co/functions/v1/weekly-briefing',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'cron_briefing_secret'
      )
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
