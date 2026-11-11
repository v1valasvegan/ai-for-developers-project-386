import { useState } from "react";
import { TextInput, Textarea } from "@mantine/core";
import Catalogue from "./Catalogue";
import { createMeetingType } from "./api/generated/sdk.gen";
import type { ApiError } from "./api/generated/types.gen";

const emptyForm = { id: "", title: "", description: "", durationMinutes: "30" };

export default function OwnerTypes() {
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [created, setCreated] = useState(false);
  const [catalogueVersion, setCatalogueVersion] = useState(0);
  const fieldErrors =
    error?.code === "meeting_type_exists"
      ? { id: "Этот код уже используется. Выберите другой" }
      : error?.code === "validation_error"
        ? error.fieldErrors
        : undefined;
  const normalizedCode = form.id
    .trim()
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    setCreated(false);
    try {
      const { data, error: failure } = await createMeetingType({
        body: { ...form, durationMinutes: Number(form.durationMinutes) },
      });
      if (data) {
        setForm(emptyForm);
        setCreated(true);
        setCatalogueVersion((version) => version + 1);
      } else {
        setError(failure);
      }
    } catch {
      setError({
        code: "network_error",
        message: "Не удалось создать тип встречи. Проверьте соединение и повторите попытку",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h2>Типы встреч</h2>
      <Catalogue key={catalogueVersion} showCode />
      <form className="type-form" onSubmit={(event) => void submit(event)} noValidate>
        <h2>Создать тип встречи</h2>
        <TextInput
          label="Код типа встречи"
          required
          value={form.id}
          error={fieldErrors?.id}
          description="От 3 до 20 символов: латинские буквы, цифры и дефис. Например, intro-30"
          onChange={(event) => setForm({ ...form, id: event.currentTarget.value })}
        />
        <p className="code-preview">Будет сохранён код: {normalizedCode || "—"}</p>
        <TextInput
          label="Название"
          required
          value={form.title}
          error={fieldErrors?.title}
          onChange={(event) => setForm({ ...form, title: event.currentTarget.value })}
        />
        <Textarea
          label="Описание"
          required
          value={form.description}
          error={fieldErrors?.description}
          onChange={(event) => setForm({ ...form, description: event.currentTarget.value })}
        />
        <TextInput
          label="Длительность, минут"
          error={fieldErrors?.durationMinutes}
          type="number"
          min={15}
          max={480}
          step={15}
          required
          value={form.durationMinutes}
          onChange={(event) => setForm({ ...form, durationMinutes: event.currentTarget.value })}
        />
        {error ? (
          <p role="alert">
            {error.code === "meeting_type_exists"
              ? "Выберите другой код типа встречи"
              : error.message}
          </p>
        ) : null}
        <button className="page-link" type="submit" disabled={pending}>
          {pending ? "Создаём…" : "Создать тип встречи"}
        </button>
      </form>
      {created ? <output className="owner-toast">Тип встречи создан</output> : null}
    </>
  );
}
