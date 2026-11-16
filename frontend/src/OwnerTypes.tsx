import { useRef, useState } from "react";
import Toast from "./Toast";
import { dismissFieldError } from "./formErrors";
import { TextInput, Textarea } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queries";
import Catalogue from "./Catalogue";
import { createMeetingType } from "./api/generated/sdk.gen";
import type { ApiError } from "./api/generated/types.gen";

const emptyForm = { id: "", title: "", description: "", durationMinutes: "30" };

export default function OwnerTypes() {
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [created, setCreated] = useState<string | null>(null);
  const editedFields = useRef(new Set<keyof typeof emptyForm>());
  const queryClient = useQueryClient();
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

  function changeField(field: keyof typeof emptyForm, value: string) {
    editedFields.current.add(field);
    setForm((current) => ({ ...current, [field]: value }));
    setError((current) => dismissFieldError(current, field));
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const changedDuringRequest = new Set<keyof typeof emptyForm>();
    editedFields.current = changedDuringRequest;
    setPending(true);
    setError(undefined);
    setCreated(null);
    try {
      const { data, error: failure } = await createMeetingType({
        body: { ...form, durationMinutes: Number(form.durationMinutes) },
      });
      if (data) {
        setForm(emptyForm);
        setCreated(data.id);
        void queryClient.invalidateQueries({ queryKey: queryKeys.types });
      } else {
        let currentError: ApiError | undefined = failure;
        for (const field of changedDuringRequest) {
          currentError = dismissFieldError(currentError, field);
        }
        setError(currentError);
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
      <Catalogue showCode />
      <form className="type-form" onSubmit={(event) => void submit(event)} noValidate>
        <h2>Создать тип встречи</h2>
        <TextInput
          label="Код типа встречи"
          required
          value={form.id}
          error={fieldErrors?.id}
          description="От 3 до 20 символов: латинские буквы, цифры и дефис. Например, intro-30"
          onChange={(event) => changeField("id", event.currentTarget.value)}
        />
        <p className="code-preview">Будет сохранён код: {normalizedCode || "—"}</p>
        <TextInput
          label="Название"
          required
          value={form.title}
          error={fieldErrors?.title}
          onChange={(event) => changeField("title", event.currentTarget.value)}
        />
        <Textarea
          label="Описание"
          required
          value={form.description}
          error={fieldErrors?.description}
          onChange={(event) => changeField("description", event.currentTarget.value)}
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
          onChange={(event) => changeField("durationMinutes", event.currentTarget.value)}
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
      {created ? (
        <Toast
          key={created}
          tone="success"
          title="Тип встречи создан"
          message="Теперь его можно выбрать при записи."
        />
      ) : null}
    </>
  );
}
