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
  isRangeOccupied,
} from "../lib/google-calendar";

const router: IRouter = Router();
const ownerWhatsApp = (process.env.CASA_JUQUEHY_WHATSAPP ?? "5511953553708").replace(
  /\D/g,
  "",
);

const MAX_NIGHTS = 60;

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
  const checkIn = parsed.data.checkIn;
  const checkOut = parsed.data.checkOut;

  if (!isValidIsoDate(checkIn) || !isValidIsoDate(checkOut)) {
    res.status(400).json({ error: "Escolha datas válidas." });
    return;
  }

  const nights = nightsBetween(checkIn, checkOut);

  if (nights < 1) {
    res.status(400).json({ error: "O check-out deve ser depois do check-in." });
    return;
  }

  if (nights > MAX_NIGHTS) {
    res.status(400).json({ error: `Períodos maiores que ${MAX_NIGHTS} noites devem ser combinados diretamente pelo WhatsApp.` });
    return;
  }

  try {
    if (await isRangeOccupied(checkIn, checkOut)) {
      res.status(409).json({
        error: "Uma ou mais datas do período estão ocupadas. Escolha outro período disponível.",
      });
      return;
    }

    const eventId = await createPreReservation({ checkIn, checkOut, name, phone });

    const message =
      `Olá! Gostaria de pedir a reserva da Casa Juquehy.\n` +
      `Check-in: ${formatDatePtBr(checkIn)}\n` +
      `Check-out: ${formatDatePtBr(checkOut)}\n` +
      `${nights} ${nights === 1 ? "noite" : "noites"}\n` +
      `Meu nome é ${name}.`;

    const whatsappUrl = `https://wa.me/${ownerWhatsApp}?text=${encodeURIComponent(message)}`;

    res.status(201).json(
      CreateReservationRequestResponse.parse({
        eventId,
        checkIn,
        checkOut,
        nights,
        name,
        phone,
        whatsappUrl,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, checkIn, checkOut }, "Could not create reservation request");
    res.status(502).json({ error: "Não foi possível enviar seu pedido agora. Tente novamente." });
  }
});

export default router;
