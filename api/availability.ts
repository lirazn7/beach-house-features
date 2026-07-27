import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOccupiedDates } from "./_lib/google-calendar";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (
    !Number.isInteger(year) || year < 2020 || year > 2100 ||
    !Number.isInteger(month) || month < 1 || month > 12
  ) {
    return res.status(400).json({ error: "Parâmetros year e month inválidos." });
  }

  try {
    const occupiedDates = await getOccupiedDates(year, month);
    return res.status(200).json({ year, month, occupiedDates });
  } catch (error) {
    console.error("[availability] Google Calendar error:", error);
    return res.status(502).json({ error: "Não foi possível consultar a disponibilidade agora." });
  }
}
