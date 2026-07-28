import { type FormEvent, useCallback, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  getGetAvailabilityQueryKey,
  useCreateReservationRequest,
  useGetAvailability,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function formatDateShort(date: Date) {
  return format(date, "d 'de' MMM", { locale: ptBR });
}

function formatDateLong(date: Date) {
  return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return fallback;
}

type SelectionStep = "checkIn" | "checkOut";

export function ReservationSection() {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [step, setStep] = useState<SelectionStep>("checkIn");
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState<{
    checkIn: string;
    checkOut: string;
    nights: number;
    whatsappUrl: string;
  } | null>(null);

  // Accumulate occupied dates across all fetched months so range validation
  // works even when check-in and check-out are in different months.
  const occupiedCacheRef = useRef<Map<string, Set<string>>>(new Map());

  const params = useMemo(
    () => ({
      year: visibleMonth.getFullYear(),
      month: visibleMonth.getMonth() + 1,
    }),
    [visibleMonth],
  );

  // Also prefetch the next month so the user can see ahead when selecting check-out.
  const nextMonthDate = addMonths(visibleMonth, 1);
  const nextParams = useMemo(
    () => ({
      year: nextMonthDate.getFullYear(),
      month: nextMonthDate.getMonth() + 1,
    }),
    [nextMonthDate],
  );

  const availabilityQuery = useGetAvailability(params, {
    query: { queryKey: getGetAvailabilityQueryKey(params) },
  });
  const nextMonthQuery = useGetAvailability(nextParams, {
    query: { queryKey: getGetAvailabilityQueryKey(nextParams) },
  });
  const reservationMutation = useCreateReservationRequest();

  // Merge fetched data into the running cache.
  useMemo(() => {
    if (availabilityQuery.data) {
      const key = `${availabilityQuery.data.year}-${availabilityQuery.data.month}`;
      occupiedCacheRef.current.set(key, new Set(availabilityQuery.data.occupiedDates));
    }
  }, [availabilityQuery.data]);

  useMemo(() => {
    if (nextMonthQuery.data) {
      const key = `${nextMonthQuery.data.year}-${nextMonthQuery.data.month}`;
      occupiedCacheRef.current.set(key, new Set(nextMonthQuery.data.occupiedDates));
    }
  }, [nextMonthQuery.data]);

  // Merge all cached occupied dates into a flat set.
  const allOccupiedDates = useMemo(() => {
    const merged = new Set<string>();
    for (const dateSet of occupiedCacheRef.current.values()) {
      for (const d of dateSet) merged.add(d);
    }
    return merged;
  }, [availabilityQuery.data, nextMonthQuery.data]);

  // Find the first occupied date strictly after a given date (used to cap
  // the checkout range when check-in is already selected).
  const firstOccupiedAfter = useCallback(
    (from: Date): Date | null => {
      let cursor = addDays(from, 1);
      for (let i = 0; i < 365; i++) {
        if (allOccupiedDates.has(format(cursor, "yyyy-MM-dd"))) return cursor;
        cursor = addDays(cursor, 1);
      }
      return null;
    },
    [allOccupiedDates],
  );

  const calendarDays = useMemo(() => {
    const firstDay = startOfMonth(visibleMonth);
    const leadingDays = getDay(firstDay);
    const totalDays = endOfMonth(visibleMonth).getDate();
    const gridLength = Math.ceil((leadingDays + totalDays) / 7) * 7;
    return Array.from({ length: gridLength }, (_, i) => addDays(firstDay, i - leadingDays));
  }, [visibleMonth]);

  const today = startOfDay(new Date());
  const isCalendarLoading = availabilityQuery.isLoading || availabilityQuery.isFetching;

  // The ceiling check-out (exclusive) when check-in is set.
  const maxCheckOut = useMemo(
    () => (checkIn ? firstOccupiedAfter(checkIn) : null),
    [checkIn, firstOccupiedAfter],
  );

  const moveMonth = (direction: "previous" | "next") => {
    setVisibleMonth((cur) =>
      direction === "previous" ? subMonths(cur, 1) : addMonths(cur, 1),
    );
    setFormError("");
  };

  const resetSelection = () => {
    setCheckIn(null);
    setCheckOut(null);
    setStep("checkIn");
    setHoverDate(null);
    setFormError("");
    setSuccess(null);
  };

  const handleSelectDate = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const isOccupied = allOccupiedDates.has(dateKey);
    const isPast = isBefore(date, today);
    if (isOccupied || isPast || isCalendarLoading) return;

    if (step === "checkIn") {
      setCheckIn(date);
      setCheckOut(null);
      setStep("checkOut");
      setFormError("");
      setSuccess(null);
      return;
    }

    // step === "checkOut"
    if (!checkIn) return;

    // Clicking before or equal to check-in restarts selection.
    if (!isBefore(checkIn, date)) {
      setCheckIn(date);
      setCheckOut(null);
      setStep("checkOut");
      setFormError("");
      return;
    }

    // Block if the range would cross an occupied date.
    if (maxCheckOut && !isBefore(date, maxCheckOut)) {
      setFormError("O período inclui datas já ocupadas. Escolha um check-out anterior.");
      return;
    }

    setCheckOut(date);
    setStep("checkIn"); // ready to submit or start new selection
    setFormError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!checkIn || !checkOut) {
      setFormError("Escolha o período (check-in e check-out) no calendário.");
      return;
    }

    if (name.trim().length < 2) {
      setFormError("Conte para nós como podemos chamar você.");
      return;
    }

    if (phone.trim().length < 8) {
      setFormError("Confira seu telefone com DDD.");
      return;
    }

    setFormError("");
    setSuccess(null);

    reservationMutation.mutate(
      {
        data: {
          checkIn: format(checkIn, "yyyy-MM-dd"),
          checkOut: format(checkOut, "yyyy-MM-dd"),
          name: name.trim(),
          phone: phone.trim(),
        },
      },
      {
        onSuccess: (result: any) => {
          setSuccess({
            checkIn: result.checkIn,
            checkOut: result.checkOut,
            nights: result.nights,
            whatsappUrl: result.whatsappUrl,
          });
        },
        onError: (error: any) => {
          setFormError(
            getErrorMessage(
              error,
              "Não conseguimos guardar este período agora. Tente novamente em instantes.",
            ),
          );
        },
      },
    );
  };

  const nights =
    checkIn && checkOut ? differenceInCalendarDays(checkOut, checkIn) : null;

  // Preview end date as the user hovers when check-in is set but check-out is not.
  const previewEnd =
    step === "checkOut" && checkIn && hoverDate && isBefore(checkIn, hoverDate)
      ? hoverDate
      : null;

  const rangeStart = checkIn;
  const rangeEnd = checkOut ?? previewEnd;

  return (
    <section
      id="reservas"
      data-testid="reservation-section"
      className="relative overflow-hidden bg-[#e9dfd0] px-6 py-24 md:py-32"
    >
      <div className="pointer-events-none absolute -right-28 top-20 h-72 w-72 rounded-full border border-primary/15 md:h-96 md:w-96" />
      <div className="pointer-events-none absolute -left-40 bottom-[-8rem] h-96 w-96 rounded-full bg-secondary/10" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-20">
          {/* ── Left column ─────────────────────────────── */}
          <div className="space-y-8 lg:sticky lg:top-10">
            <Reveal animation="fade-up">
              <span className="mb-4 block text-sm font-semibold uppercase tracking-[0.22em] text-secondary">
                Antes de chegar
              </span>
              <h2
                data-testid="heading-reservation"
                className="max-w-lg text-4xl leading-[1.08] text-foreground md:text-6xl"
              >
                Escolha o período que você quer ficar.
              </h2>
            </Reveal>

            <Reveal animation="fade-up" delay={150}>
              <p className="max-w-md text-lg font-light leading-relaxed text-muted-foreground">
                Selecione o check-in e o check-out no calendário. Ao enviar seus dados,
                deixamos o período pré-reservado e combinamos os detalhes pelo WhatsApp.
              </p>
            </Reveal>

            <Reveal animation="fade-up" delay={250}>
              <div className="space-y-5 border-l border-primary/40 pl-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    className="mt-0.5 shrink-0 text-secondary"
                    size={20}
                    strokeWidth={1.5}
                  />
                  <div>
                    <p className="font-medium text-foreground">Seu pedido é cuidado de perto</p>
                    <p className="mt-1 text-sm font-light leading-relaxed text-muted-foreground">
                      Uma pessoa da Casa confirma os detalhes com você pelo WhatsApp.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles
                    className="mt-0.5 shrink-0 text-primary"
                    size={20}
                    strokeWidth={1.5}
                  />
                  <div>
                    <p className="font-medium text-foreground">Sem pagamento agora</p>
                    <p className="mt-1 text-sm font-light leading-relaxed text-muted-foreground">
                      A confirmação e o combinado financeiro acontecem diretamente com a Casa.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* ── Right column / card ──────────────────────── */}
          <Reveal animation="fade-up" delay={150}>
            <div
              data-testid="reservation-card"
              className="overflow-hidden rounded-[2rem] border border-white/70 bg-background/90 shadow-[0_24px_70px_rgba(87,65,45,0.12)] backdrop-blur-sm"
            >
              {/* Calendar header */}
              <div className="border-b border-border/70 px-6 pb-5 pt-7 md:px-9">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                      Disponibilidade
                    </p>
                    <p
                      data-testid="text-current-month"
                      className="mt-2 text-2xl text-foreground capitalize md:text-3xl"
                    >
                      {format(visibleMonth, "MMMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Mês anterior"
                      data-testid="button-reservation-previous-month"
                      onClick={() => moveMonth("previous")}
                      className="h-10 w-10 rounded-full border-border bg-transparent text-foreground hover:bg-accent"
                    >
                      <ChevronLeft size={18} />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Próximo mês"
                      data-testid="button-reservation-next-month"
                      onClick={() => moveMonth("next")}
                      className="h-10 w-10 rounded-full border-border bg-transparent text-foreground hover:bg-accent"
                    >
                      <ChevronRight size={18} />
                    </Button>
                  </div>
                </div>

                {/* Step indicator */}
                <div className="mt-4 flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                      step === "checkIn" && !checkIn
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-muted-foreground",
                    )}
                  >
                    1 · Check-in
                  </span>
                  <span className="text-muted-foreground/40">→</span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                      step === "checkOut"
                        ? "bg-primary text-primary-foreground"
                        : checkOut
                          ? "bg-accent text-muted-foreground"
                          : "text-muted-foreground/50",
                    )}
                  >
                    2 · Check-out
                  </span>
                  {(checkIn || checkOut) && (
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <p
                  data-testid="status-availability"
                  className="mt-3 flex min-h-5 items-center gap-2 text-sm font-light text-muted-foreground"
                >
                  {isCalendarLoading ? (
                    <>
                      <LoaderCircle className="animate-spin text-primary" size={14} />
                      Consultando datas da casa...
                    </>
                  ) : availabilityQuery.isError ? (
                    <>
                      <CircleAlert className="text-destructive" size={14} />
                      Não foi possível consultar este mês.
                    </>
                  ) : (
                    "As datas em terracota já estão ocupadas."
                  )}
                </p>
              </div>

              {/* Calendar grid */}
              <div className="px-6 py-6 md:px-9">
                {availabilityQuery.isError ? (
                  <div
                    data-testid="status-availability-error"
                    className="flex min-h-[21rem] flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-accent/30 px-6 text-center"
                  >
                    <CircleAlert
                      className="mb-4 text-primary"
                      size={28}
                      strokeWidth={1.5}
                    />
                    <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                      {getErrorMessage(
                        availabilityQuery.error,
                        "A disponibilidade está descansando por um momento.",
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="button-retry-availability"
                      onClick={() => availabilityQuery.refetch()}
                      className="mt-5 rounded-full border-primary/40"
                    >
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <div
                    data-testid="calendar-reservation"
                    aria-label="Calendário de disponibilidade"
                    className={cn(
                      "transition-opacity duration-300",
                      isCalendarLoading && "opacity-50",
                    )}
                  >
                    <div className="mb-3 grid grid-cols-7 gap-1 text-center">
                      {WEEKDAYS.map((weekday) => (
                        <span
                          key={weekday}
                          data-testid={`text-weekday-${weekday}`}
                          className="py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {weekday}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-y-1">
                      {calendarDays.map((day) => {
                        const dateKey = format(day, "yyyy-MM-dd");
                        const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                        const isOccupied = allOccupiedDates.has(dateKey);
                        const isPast = isBefore(day, today);
                        const isToday = isSameDay(day, today);
                        const isCheckIn = checkIn ? isSameDay(day, checkIn) : false;
                        const isCheckOut = checkOut ? isSameDay(day, checkOut) : false;
                        const isEndpoint = isCheckIn || isCheckOut;

                        // Is this day inside the selected (or hover-preview) range?
                        const inRange =
                          rangeStart &&
                          rangeEnd &&
                          !isSameDay(rangeStart, rangeEnd) &&
                          isWithinInterval(day, {
                            start: rangeStart,
                            end: rangeEnd,
                          }) &&
                          !isSameDay(day, rangeStart) &&
                          !isSameDay(day, rangeEnd);

                        // Checkout date is blocked if it would include an occupied night.
                        const isBlockedCheckOut =
                          step === "checkOut" &&
                          checkIn &&
                          !isBefore(day, checkIn) &&
                          maxCheckOut &&
                          !isBefore(day, maxCheckOut);

                        const isDisabled =
                          !isCurrentMonth ||
                          isOccupied ||
                          isPast ||
                          isCalendarLoading ||
                          !!isBlockedCheckOut;

                        const isRangeStart = rangeStart ? isSameDay(day, rangeStart) : false;
                        const isRangeEnd = rangeEnd ? isSameDay(day, rangeEnd) : false;

                        return (
                          <button
                            key={dateKey}
                            type="button"
                            data-testid={`button-reservation-date-${dateKey}`}
                            aria-label={`${formatDateLong(day)}${isOccupied ? ", indisponível" : ""}`}
                            aria-pressed={isCheckIn || isCheckOut}
                            disabled={isDisabled}
                            onClick={() => handleSelectDate(day)}
                            onMouseEnter={() =>
                              step === "checkOut" ? setHoverDate(day) : undefined
                            }
                            onMouseLeave={() =>
                              step === "checkOut" ? setHoverDate(null) : undefined
                            }
                            className={cn(
                              "relative flex aspect-square items-center justify-center text-sm transition-colors duration-150",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                              // base
                              isCurrentMonth &&
                                !isDisabled &&
                                !isEndpoint &&
                                !inRange &&
                                "rounded-xl text-foreground hover:bg-accent",
                              !isCurrentMonth && "text-muted-foreground/25",
                              isPast && isCurrentMonth && "text-muted-foreground/40",
                              // occupied
                              isOccupied &&
                                isCurrentMonth &&
                                "rounded-xl bg-primary/10 text-primary/55 line-through",
                              // today dot
                              isToday &&
                                !isEndpoint &&
                                !inRange &&
                                isCurrentMonth &&
                                "font-semibold text-secondary after:absolute after:bottom-1.5 after:h-1 after:w-1 after:rounded-full after:bg-secondary",
                              // range interior (no border-radius on sides)
                              inRange &&
                                "bg-primary/15 text-foreground rounded-none first:rounded-l-xl last:rounded-r-xl",
                              // endpoints
                              isRangeStart &&
                                rangeEnd &&
                                !isSameDay(rangeStart!, rangeEnd) &&
                                "rounded-r-none",
                              isRangeEnd &&
                                rangeStart &&
                                !isSameDay(rangeStart, rangeEnd!) &&
                                "rounded-l-none",
                              isEndpoint &&
                                "rounded-xl bg-primary font-semibold text-primary-foreground shadow-md hover:bg-primary/90 z-10",
                            )}
                          >
                            {format(day, "d")}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-light text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                        Check-in / Check-out
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary/20" />
                        Período escolhido
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary/10 ring-1 ring-primary/30" />
                        Ocupada
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Form / Success */}
              <div className="border-t border-border/70 bg-accent/25 px-6 py-6 md:px-9 md:py-7">
                {success ? (
                  <div data-testid="status-reservation-success" className="space-y-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <Check size={21} strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-xl text-foreground">Pedido recebido com carinho.</p>
                        <p className="mt-1 text-sm font-light leading-relaxed text-muted-foreground">
                          Guardamos{" "}
                          <strong className="font-medium text-foreground">
                            {success.nights} {success.nights === 1 ? "noite" : "noites"}
                          </strong>{" "}
                          — de{" "}
                          <strong className="font-medium text-foreground">
                            {formatDateShort(new Date(`${success.checkIn}T12:00:00`))}
                          </strong>{" "}
                          a{" "}
                          <strong className="font-medium text-foreground">
                            {formatDateShort(new Date(`${success.checkOut}T12:00:00`))}
                          </strong>
                          . Agora só falta combinarmos os detalhes.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      asChild
                      data-testid="link-reservation-whatsapp"
                      className="w-full rounded-full bg-secondary py-6 text-secondary-foreground hover:bg-secondary/90"
                    >
                      <a href={success.whatsappUrl} target="_blank" rel="noopener noreferrer">
                        Continuar pelo WhatsApp
                        <MessageCircle className="ml-2" size={17} />
                      </a>
                    </Button>
                    <button
                      type="button"
                      data-testid="button-new-reservation"
                      onClick={resetSelection}
                      className="mx-auto flex items-center text-sm font-medium text-muted-foreground underline decoration-primary/50 underline-offset-4 transition-colors hover:text-foreground"
                    >
                      Escolher outro período
                      <ArrowRight className="ml-2" size={14} />
                    </button>
                  </div>
                ) : (
                  <form data-testid="reservation-form" onSubmit={handleSubmit} className="space-y-5">
                    {/* Period summary */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                          Check-in
                        </p>
                        <p
                          data-testid="text-selected-checkin"
                          className="mt-1.5 min-h-7 text-base capitalize text-foreground"
                        >
                          {checkIn
                            ? formatDateShort(checkIn)
                            : <span className="text-muted-foreground/60 text-sm">Selecione no calendário</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                          Check-out
                        </p>
                        <p
                          data-testid="text-selected-checkout"
                          className="mt-1.5 min-h-7 text-base capitalize text-foreground"
                        >
                          {checkOut
                            ? formatDateShort(checkOut)
                            : <span className="text-muted-foreground/60 text-sm">
                                {checkIn ? "Selecione a saída" : "—"}
                              </span>}
                        </p>
                      </div>
                    </div>
                    {nights !== null && (
                      <p className="text-sm font-medium text-secondary">
                        {nights} {nights === 1 ? "noite" : "noites"}
                      </p>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Seu nome</span>
                        <input
                          data-testid="input-reservation-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Como podemos chamar você?"
                          autoComplete="name"
                          maxLength={120}
                          className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">WhatsApp</span>
                        <input
                          data-testid="input-reservation-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="(11) 99999-9999"
                          autoComplete="tel"
                          maxLength={30}
                          className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                      </label>
                    </div>

                    {formError && (
                      <p
                        data-testid="status-reservation-error"
                        role="alert"
                        className="flex items-start gap-2 text-sm leading-relaxed text-destructive"
                      >
                        <CircleAlert className="mt-0.5 shrink-0" size={16} />
                        {formError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      data-testid="button-submit-reservation"
                      disabled={reservationMutation.isPending || !checkIn || !checkOut}
                      className="w-full rounded-full bg-primary py-6 text-base text-primary-foreground shadow-lg shadow-primary/15 transition-transform hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70"
                    >
                      {reservationMutation.isPending ? (
                        <>
                          <LoaderCircle className="mr-2 animate-spin" size={18} />
                          Enviando seu pedido...
                        </>
                      ) : (
                        <>
                          Checar disponibilidade
                          <ArrowRight className="ml-2" size={18} />
                        </>
                      )}
                    </Button>
                    <p className="text-center text-xs font-light leading-relaxed text-muted-foreground">
                      Sem pagamento agora. A confirmação acontece diretamente com a Casa.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
