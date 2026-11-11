import { useState } from "react";
import { createBooking } from "./api/generated/sdk.gen";
import type { ApiError, Booking, CreateBooking } from "./api/generated/types.gen";

export type Guest = { name: string; email: string };
export type Attempt = { body: CreateBooking; status: "pending" | "uncertain" };

export default function GuestDetails({
  id,
  startsAt,
  guest,
  setGuest,
  onSuccess,
  attempt,
  setAttempt,
  onUnavailable,
}: {
  id: string;
  startsAt: string;
  guest: Guest;
  setGuest: (guest: Guest) => void;
  onSuccess: (booking: Booking) => void;
  attempt: Attempt | null;
  setAttempt: (attempt: Attempt | null) => void;
  onUnavailable: (message: string) => void;
}) {
  const pending = attempt?.status === "pending";
  const [error, setError] = useState<ApiError | null>(null);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const body = attempt?.body ?? {
      meetingTypeId: id,
      startsAt,
      ...guest,
      idempotencyKey: crypto.randomUUID(),
    };
    setAttempt({ body, status: "pending" });
    setError(null);
    try {
      const { data } = await createBooking({ body, throwOnError: true });
      setAttempt(null);
      onSuccess(data);
    } catch (failure) {
      const known =
        typeof failure === "object" && failure !== null && "code" in failure && "message" in failure
          ? (failure as ApiError)
          : null;
      if (
        known &&
        [
          "validation_error",
          "meeting_type_not_found",
          "slot_conflict",
          "idempotency_key_reused",
        ].includes(known.code)
      ) {
        setAttempt(null);
        if (
          known.code === "slot_conflict" ||
          (known.code === "validation_error" && known.fieldErrors?.startsAt)
        )
          onUnavailable(known.message);
        else setError(known);
      } else {
        setAttempt({ body, status: "uncertain" });
      }
    }
  }
  return (
    <form className="booking-guest-form" noValidate onSubmit={submit}>
      <h3>Имя и email</h3>
      {attempt?.status === "uncertain" ? (
        <>
          <p role="alert">
            Не удалось получить подтверждение. Запись могла создаться. Повторите отправку
          </p>
          <p>Предыдущая запись могла сохраниться и не отменяется. Новая попытка не заменяет её.</p>
          <button
            className="page-link"
            type="button"
            onClick={() => {
              setAttempt(null);
              onUnavailable(
                "Предыдущая запись могла сохраниться и не отменяется. Выберите время для новой попытки",
              );
            }}
          >
            Начать новую попытку
          </button>
        </>
      ) : null}
      {error ? <p role="alert">{error.message}</p> : null}
      <label>
        Имя
        <input
          name="name"
          disabled={attempt !== null}
          required
          autoComplete="name"
          value={guest.name}
          aria-invalid={Boolean(error?.fieldErrors?.name)}
          aria-describedby={error?.fieldErrors?.name ? "booking-name-error" : undefined}
          onChange={(event) => setGuest({ ...guest, name: event.target.value })}
        />
      </label>
      {error?.fieldErrors?.name ? <p id="booking-name-error">{error.fieldErrors.name}</p> : null}
      <label>
        Email
        <input
          name="email"
          disabled={attempt !== null}
          required
          type="email"
          autoComplete="email"
          value={guest.email}
          aria-invalid={Boolean(error?.fieldErrors?.email)}
          aria-describedby={error?.fieldErrors?.email ? "booking-email-error" : undefined}
          onChange={(event) => setGuest({ ...guest, email: event.target.value })}
        />
      </label>
      {error?.fieldErrors?.email ? <p id="booking-email-error">{error.fieldErrors.email}</p> : null}
      <button className="page-link" type="submit" disabled={pending}>
        {pending ? "Отправляем…" : attempt ? "Повторить" : "Подтвердить запись"}
      </button>
    </form>
  );
}
