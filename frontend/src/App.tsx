import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  NumberInput,
  Paper,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { IconCalendar, IconEdit, IconPlus } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import {
  ApiError,
  createBooking,
  createEventType,
  getAdminBookings,
  getAdminEventTypes,
  getPublicEventTypes,
  getSlots,
  updateEventType,
} from './shared/api'
import type { EventType } from './types/api'
import './App.css'

type EventTypeFormState = {
  name: string
  description: string
  durationMinutes: number
  slotStepMinutes: string
}

const emptyEventTypeForm: EventTypeFormState = {
  name: '',
  description: '',
  durationMinutes: 30,
  slotStepMinutes: '30',
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

function AppLayout() {
  const location = useLocation()

  return (
    <AppShell header={{ height: 72 }} padding="md">
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Group gap="xs">
              <IconCalendar size={24} />
              <Title order={3}>Calendar Booking</Title>
            </Group>
            <Group>
              <Button
                component={Link}
                to="/"
                variant={location.pathname === '/' ? 'filled' : 'light'}
              >
                Guest
              </Button>
              <Button
                component={Link}
                to="/admin"
                variant={location.pathname === '/admin' ? 'filled' : 'light'}
              >
                Admin
              </Button>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="lg" py="md">
          <Routes>
            <Route path="/" element={<GuestPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}

function GuestPage() {
  const queryClient = useQueryClient()
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestComment, setGuestComment] = useState('')
  const [from, setFrom] = useState(dayjs().format('YYYY-MM-DD'))

  const normalizedFrom = useMemo(() => {
    const selectedStart = dayjs(from).startOf('day')
    const now = dayjs()

    if (selectedStart.isBefore(now)) {
      return now.toISOString()
    }

    return selectedStart.toISOString()
  }, [from])

  const eventTypesQuery = useQuery({
    queryKey: ['event-types', 'public'],
    queryFn: getPublicEventTypes,
  })

  const slotsQuery = useQuery({
    queryKey: ['slots', selectedEventTypeId, normalizedFrom],
    queryFn: () =>
      getSlots(selectedEventTypeId!, {
        from: normalizedFrom,
      }),
    enabled: Boolean(selectedEventTypeId),
  })

  const slotOptions = useMemo(() => {
    return (slotsQuery.data ?? [])
      .filter((slot) => slot.isAvailable)
      .map((slot) => ({
        value: slot.startAt,
        label: `${dayjs(slot.startAt).format('DD MMM, HH:mm')} - ${dayjs(slot.endAt).format('HH:mm')}`,
      }))
  }, [slotsQuery.data])

  const bookingMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      notifications.show({
        color: 'teal',
        title: 'Booking created',
        message: 'Your meeting is confirmed.',
      })
      setSelectedSlot(null)
      setGuestName('')
      setGuestEmail('')
      setGuestPhone('')
      setGuestComment('')
      queryClient.invalidateQueries({ queryKey: ['slots'] })
    },
    onError: (error) => {
      const message =
        error instanceof ApiError && error.status === 409
          ? 'This slot is already occupied. Please choose another one.'
          : getErrorMessage(error)

      notifications.show({
        color: 'red',
        title: 'Booking failed',
        message,
      })
    },
  })

  return (
    <Stack gap="lg">
      <Paper p="lg" radius="md" withBorder className="hero-surface">
        <Title order={2}>Book a meeting</Title>
        <Text c="dimmed" mt="xs">
          Choose an event type, pick a free slot from the next 14 days, and submit your booking.
        </Text>
      </Paper>

      <Stack gap="md">
        <Title order={3}>1. Event types</Title>
        {eventTypesQuery.isError && (
          <Alert color="red" title="Cannot load event types">
            {getErrorMessage(eventTypesQuery.error)}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {(eventTypesQuery.data ?? []).map((eventType) => {
            const isSelected = selectedEventTypeId === eventType.id

            return (
              <Card
                key={eventType.id}
                withBorder
                padding="lg"
                radius="md"
                data-testid={`guest-event-type-card-${eventType.id}`}
                className={isSelected ? 'active-card' : ''}
              >
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Title order={4}>{eventType.name}</Title>
                    <Group gap="xs">
                      {isSelected && <Badge color="teal">Selected</Badge>}
                      <Badge color="teal" variant={isSelected ? 'filled' : 'light'}>
                        {eventType.durationMinutes} min
                      </Badge>
                    </Group>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {eventType.description}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Slot step: {eventType.slotStepMinutes} minutes
                  </Text>
                  <Button
                    mt="sm"
                    variant={isSelected ? 'filled' : 'light'}
                    data-testid={`guest-select-event-type-${eventType.id}`}
                    onClick={() => setSelectedEventTypeId(eventType.id)}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </Button>
                </Stack>
              </Card>
            )
          })}
        </SimpleGrid>
      </Stack>

      <Divider />

      <Stack gap="md">
        <Title order={3}>2. Slot and guest details</Title>
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Stack>
            <TextInput
              label="Start date"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.currentTarget.value)}
              min={dayjs().format('YYYY-MM-DD')}
              max={dayjs().add(13, 'day').format('YYYY-MM-DD')}
            />
            <Select
              label="Available slots"
              placeholder={selectedEventTypeId ? 'Pick a slot' : 'Select event type first'}
              disabled={!selectedEventTypeId}
              data={slotOptions}
              value={selectedSlot}
              onChange={setSelectedSlot}
              searchable
            />
          </Stack>

          <Stack>
            <TextInput
              label="Guest name"
              value={guestName}
              onChange={(event) => setGuestName(event.currentTarget.value)}
              required
            />
            <TextInput
              label="Guest email"
              type="email"
              value={guestEmail}
              onChange={(event) => setGuestEmail(event.currentTarget.value)}
              required
            />
            <TextInput
              label="Phone (optional)"
              value={guestPhone}
              onChange={(event) => setGuestPhone(event.currentTarget.value)}
            />
            <Textarea
              label="Comment (optional)"
              minRows={2}
              value={guestComment}
              onChange={(event) => setGuestComment(event.currentTarget.value)}
            />
            <Button
              data-testid="guest-create-booking"
              disabled={!selectedEventTypeId || !selectedSlot || !guestName || !guestEmail}
              loading={bookingMutation.isPending}
              onClick={() => {
                if (!selectedEventTypeId || !selectedSlot) {
                  return
                }

                bookingMutation.mutate({
                  eventTypeId: selectedEventTypeId,
                  startAt: selectedSlot,
                  guestName,
                  guestEmail,
                  guestPhone: guestPhone || undefined,
                  guestComment: guestComment || undefined,
                })
              }}
            >
              Create booking
            </Button>
          </Stack>
        </SimpleGrid>
      </Stack>
    </Stack>
  )
}

function AdminPage() {
  const queryClient = useQueryClient()
  const [editEventType, setEditEventType] = useState<EventType | null>(null)
  const [formState, setFormState] = useState<EventTypeFormState>(emptyEventTypeForm)

  const eventTypesQuery = useQuery({
    queryKey: ['event-types', 'admin'],
    queryFn: getAdminEventTypes,
  })

  const upcomingQuery = useQuery({
    queryKey: ['bookings', 'admin-upcoming'],
    queryFn: getAdminBookings,
  })

  const createMutation = useMutation({
    mutationFn: createEventType,
    onSuccess: () => {
      notifications.show({
        color: 'teal',
        title: 'Event type created',
        message: 'New event type is now available for guests.',
      })
      setFormState(emptyEventTypeForm)
      queryClient.invalidateQueries({ queryKey: ['event-types'] })
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Cannot create event type',
        message: getErrorMessage(error),
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateEventType,
    onSuccess: () => {
      notifications.show({
        color: 'teal',
        title: 'Event type updated',
        message: 'Changes have been saved.',
      })
      setEditEventType(null)
      setFormState(emptyEventTypeForm)
      queryClient.invalidateQueries({ queryKey: ['event-types'] })
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Cannot update event type',
        message: getErrorMessage(error),
      })
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <Stack gap="lg">
      <Paper p="lg" radius="md" withBorder className="hero-surface">
        <Title order={2}>Admin panel</Title>
        <Text c="dimmed" mt="xs">
          Manage event types and review upcoming bookings from all event categories.
        </Text>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card withBorder padding="lg" radius="md">
          <Stack>
            <Group justify="space-between">
              <Title order={4}>{editEventType ? 'Edit event type' : 'Create event type'}</Title>
              {editEventType && (
                <Button
                  variant="subtle"
                  onClick={() => {
                    setEditEventType(null)
                    setFormState(emptyEventTypeForm)
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </Group>

            <TextInput
              label="Name"
              required
              value={formState.name}
              onChange={(event) => {
                const value = event.currentTarget.value
                setFormState((state) => ({ ...state, name: value }))
              }}
            />
            <Textarea
              label="Description"
              required
              minRows={2}
              value={formState.description}
              onChange={(event) => {
                const value = event.currentTarget.value
                setFormState((state) => ({ ...state, description: value }))
              }}
            />
            <NumberInput
              label="Duration (minutes)"
              required
              min={5}
              max={180}
              value={formState.durationMinutes}
              onChange={(value) =>
                setFormState((state) => ({ ...state, durationMinutes: Number(value) || 30 }))
              }
            />
            <Radio.Group
              label="Slot step"
              value={formState.slotStepMinutes}
              onChange={(value) => setFormState((state) => ({ ...state, slotStepMinutes: value }))}
            >
              <Group mt="xs">
                <Radio value="15" label="15 minutes" />
                <Radio value="30" label="30 minutes" />
              </Group>
            </Radio.Group>

            <Button
              leftSection={editEventType ? <IconEdit size={16} /> : <IconPlus size={16} />}
              data-testid="admin-submit-event-type"
              loading={isSubmitting}
              disabled={!formState.name || !formState.description}
              onClick={() => {
                const payload = {
                  name: formState.name,
                  description: formState.description,
                  durationMinutes: formState.durationMinutes,
                  slotStepMinutes: Number(formState.slotStepMinutes) as 15 | 30,
                }

                if (editEventType) {
                  updateMutation.mutate({ id: editEventType.id, ...payload })
                  return
                }

                createMutation.mutate(payload)
              }}
            >
              {editEventType ? 'Save changes' : 'Create event type'}
            </Button>
          </Stack>
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Stack>
            <Title order={4}>Event types</Title>
            {eventTypesQuery.isError && (
              <Alert color="red" title="Cannot load event types">
                {getErrorMessage(eventTypesQuery.error)}
              </Alert>
            )}

            {(eventTypesQuery.data ?? []).map((eventType) => (
              <Paper key={eventType.id} withBorder p="sm" radius="md" data-testid={`admin-event-type-${eventType.id}`}>
                <Group justify="space-between" align="flex-start">
                  <Box>
                    <Text fw={700}>{eventType.name}</Text>
                    <Text size="sm" c="dimmed">
                      {eventType.description}
                    </Text>
                    <Text size="xs" mt={4}>
                      {eventType.durationMinutes} min · step {eventType.slotStepMinutes} min
                    </Text>
                  </Box>
                  <ActionIcon
                    variant="light"
                    data-testid={`admin-edit-event-type-${eventType.id}`}
                    onClick={() => {
                      setEditEventType(eventType)
                      setFormState({
                        name: eventType.name,
                        description: eventType.description,
                        durationMinutes: eventType.durationMinutes,
                        slotStepMinutes: String(eventType.slotStepMinutes),
                      })
                    }}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="lg" radius="md">
        <Stack>
          <Title order={4}>Upcoming bookings</Title>
          {upcomingQuery.isError && (
            <Alert color="red" title="Cannot load bookings">
              {getErrorMessage(upcomingQuery.error)}
            </Alert>
          )}

          <Table.ScrollContainer minWidth={680}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Event type</Table.Th>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Guest</Table.Th>
                  <Table.Th>Contact</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(upcomingQuery.data ?? []).map((booking) => (
                  <Table.Tr key={booking.id} data-testid={`admin-booking-${booking.id}`}>
                    <Table.Td>{booking.eventTypeId}</Table.Td>
                    <Table.Td>
                      {dayjs(booking.startAt).format('DD MMM YYYY, HH:mm')} -{' '}
                      {dayjs(booking.endAt).format('HH:mm')}
                    </Table.Td>
                    <Table.Td>{booking.guestName}</Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm">{booking.guestEmail}</Text>
                        {booking.guestPhone && (
                          <Text size="xs" c="dimmed">
                            {booking.guestPhone}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>
    </Stack>
  )
}

export default App
