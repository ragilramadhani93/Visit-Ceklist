import nodemailer from "npm:nodemailer@6.9.7"

const SMTP_USER = Deno.env.get('SMTP_USER')
const SMTP_PASS = Deno.env.get('SMTP_PASS')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, auditorName, location, date, reportUrl } = await req.json()

    // Fallback credentials if env vars are missing (for local dev convenience)
    // In production, you should set these in the Supabase Dashboard > Edge Functions > Secrets
    const user = SMTP_USER || 'ragilramadhani@gmail.com';
    const pass = SMTP_PASS || 'epxc zwgv jmtw mbhs';

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass,
      },
    })

    const info = await transporter.sendMail({
      from: `"Field Ops Pro" <${user}>`,
      to: Array.isArray(email) ? email.join(', ') : email,
      subject: `Audit Report: ${location} - ${date}`,
      html: `
        <h1>Audit Report Completed</h1>
        <p>Hi there,</p>
        <p>An audit has been successfully completed for <strong>${location}</strong> on ${date} by ${auditorName}.</p>
        <p>You can download the report PDF here:</p>
        <a href="${reportUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Download Report</a>
        <br/><br/>
        <p>Best regards,<br/>Field Ops Pro Team</p>
      `,
    })

    return new Response(JSON.stringify(info), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
