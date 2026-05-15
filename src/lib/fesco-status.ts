/**
 * UI-only translation of Russian FESCO/1C status strings.
 * Original values in Supabase are never modified — translation is display-only.
 * Unknown strings fall back to the original text.
 */
const RU_STATUS_MAP: Record<string, string> = {
  // Booking lifecycle
  'Новая':                      'New',
  'Принято':                    'Accepted',
  'Заявка принята':             'Application accepted',
  'На рассмотрении':            'Under review',
  'В обработке':                'Processing',
  'Ожидает подтверждения':      'Awaiting confirmation',
  'Согласовано':                'Agreed',
  'Подтверждено':               'Confirmed',
  'Ожидает оплаты':             'Awaiting payment',
  'Оплачено':                   'Paid',
  'Частично оплачено':          'Partially paid',

  // In transit
  'В пути':                     'In transit',
  'Частично выполнено':         'Partially completed',
  'Исполнено':                  'Executed',

  // Terminal states
  'Выполнено':                  'Completed',
  'Завершено':                  'Completed',
  'Доставлено':                 'Delivered',
  'Закрыто':                    'Closed',
  'Отменено':                   'Cancelled',
  'Отклонено':                  'Rejected',
  'Аннулировано':               'Annulled',
}

/**
 * Returns the English translation of a Russian FESCO status string.
 * If the value is not in the map, returns the original string unchanged.
 * null / undefined / empty string pass through as-is.
 */
export function translateFescoStatus(value: string | null | undefined): string | null | undefined {
  if (!value) return value
  return RU_STATUS_MAP[value.trim()] ?? value
}
