import { Container, Paper, Stack, Text, Title } from "@mantine/core";

export default function App() {
  return (
    <Container component="main" size="sm" py="xl">
      <Paper withBorder p="xl" radius="md">
        <Stack>
          <Title order={1}>Окошко</Title>
          <Text>Сервис записи на звонки</Text>
          <Text c="dimmed">Каркас готов. Возможность записи на встречу появится позже.</Text>
        </Stack>
      </Paper>
    </Container>
  );
}
