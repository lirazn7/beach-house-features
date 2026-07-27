import { Router, type IRouter } from "express";
import {
  CreateReservationRequestBody,
  CreateReservationRequestResponse,
  GetAvailabilityQueryParams,
  GetAvailabilityResponse,
} from "@workspace/api-zod";
import {
  createPreReservation,
  getOccupiedDates,
  isDateOccupied,
} from "../lib/google-calendar";

const router: IRouter = Router();
const ownerWhatsApp = (process.env.CASA_JUQUEHY_WHATSAPP ?? "5511953553708").replace(
  /\D/g,
  "",
);

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

router.get("/availability", async (req, res): Promise<void> => {
  const parsed = GetAvailabilityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const occupiedDates = await getOccupiedDates(
      parsed.data.year,
      parsed.data.month,
    );
    res.json(
      GetAvailabilityResponse.parse({
        year: parsed.data.year,
        month: parsed.data.month,
        occupiedDates,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Could not read Google Calendar availability");
    res.status(502).json({ error: "Não foi possível consultar a disponibilidade agora." });
  }
});

router.post("/reservation-requests", async (req, res): Promise<void> => {
  const parsed = CreateReservationRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, phone } = parsed.data;
  const date = parsed.data.date;
  if (!isValidIsoDate(date)) {
    res.status(400).json({ error: "Escolha uma data válida." });
    return;
  }

  try {
    if (await isDateOccupied(date)) {
      res.status(409).json({
        error: "Essa data acabou de ser ocupada. Escolha outra data disponível.",
      });
      return;
    }

    const eventId = await createPreReservation({ date, name, phone });
    const message = `Olá! Gostaria de pedir a reserva da Casa Juquehy para o dia ${new Intl.DateTimeFormat(
      "pt-BR",
      { dateStyle: "long", timeZone: "UTC" },
    ).format(new Date(`${date}T12:00:00Z`))}. Meu nome é ${name}.`;
    const whatsappUrl = `https://wa.me/${ownerWhatsApp}?text=${encodeURIComponent(message)}`;

    res.status(201).json(
      CreateReservationRequestResponse.parse({
        eventId,
        date,
        name,
        phone,
        whatsappUrl,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, date }, "Could not create reservation request");
    res.status(502).json({ error: "Não foi possível enviar seu pedido agora. Tente novamente." });
  }
});

export default router;