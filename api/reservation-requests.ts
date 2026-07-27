import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createPreReservation, isRangeOccupied } from "./_lib/google-calendar";

const MAX_NIGHTS = 60;

const ownerWhatsApp = (process.env.CASA_JUQUEHY_WHATSAPP ?? "5511953553708").replace(
  /\D/g,
  "",
);

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return (
    (new Date(`${checkOut}T12:00:00Z`).getTime() -
      new Date(`${checkIn}T12:00:00Z`).getTime()) /
    86_400_000
  );
}

function formatDatePtBr(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { checkIn, checkOut, name, phone } = req.body ?? {};

  if (typeof checkIn !== "string" || typeof checkOut !== "string") {
    return res.status(400).json({ error: "checkIn e checkOut são obrigatórios." });
  }
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
    return res.status(400).json({ error: "Nome inválido (mínimo 2, máximo 120 caracteres)." });
  }
  if (typeof phone !== "string" || phone.trim().length < 8 || phone.trim().length > 30) {
    return res.status(400).json({ error: "Telefone inválido." });
  }
  if (!isValidIsoDate(checkIn) || !isValidIsoDate(checkOut)) {
    return res.status(400).json({ error: "Escolha datas válidas (formato YYYY-MM-DD)." });
  }

  const nights = nightsBetween(checkIn, checkOut);

  if (nights < 1) {
    return res.status(400).json({ error: "O check-out deve ser depois do check-in." });
  }
  if (nights > MAX_NIGHTS) {
    return res
      .status(400)
      .json({ error: `Períodos maiores que ${MAX_NIGHTS} noites devem ser combinados diretamente pelo WhatsApp.` });
  }

  try {
    if (await isRangeOccupied(checkIn, checkOut)) {
      return res.status(409).json({
        error: "Uma ou mais datas do período estão ocupadas. Escolha outro período disponível.",
      });
    }

    const eventId = await createPreReservation({
      checkIn,
      checkOut,
      name: name.trim(),
      phone: phone.trim(),
    });

    const message =
      `Olá! Gostaria de pedir a reserva da Casa Juquehy.\n` +
      `Check-in: ${formatDatePtBr(checkIn)}\n` +
      `Check-out: ${formatDatePtBr(checkOut)}\n` +
      `${nights} ${nights === 1 ? "noite" : "noites"}\n` +
      `Meu nome é ${name.trim()}.`;

    const whatsappUrl = `https://wa.me/${ownerWhatsApp}?text=${encodeURIComponent(message)}`;

    return res.status(201).json({
      eventId,
      checkIn,
      checkOut,
      nights,
      name: name.trim(),
      phone: phone.trim(),
      whatsappUrl,
    });
  } catch (error) {
    console.error("[reservation-requests] error:", error);
    return res.status(502).json({ error: "Não foi possível enviar seu pedido agora. Tente novamente." });
  }
}
