// FESCO-specific location strings that Mapbox cannot resolve as-is.
// Keys are lowercase; matching is case-insensitive (caller must normalize).
export const FESCO_LOCATION_ALIASES: Record<string, string> = {
  'burundaj':             'Vostochny port, Russia',
  'almaty 1':             'Almaty, Kazakhstan',
  'magadansky, port':     'Magadan, Russia',
  'krasnojarsk s':        'Krasnoyarsk, Russia',
  'vladivostok (exp)':    'Vladivostok, Russia',
  'silikatnaja':          'Silikatnaya, Moscow Oblast, Russia',
  'силикатная':           'Silikatnaya, Moscow Oblast, Russia',
  'sorokovaja':           'Sorokovaya, Russia',
  'chukursaj':            'Chukursay, Tashkent, Uzbekistan',
  'koljadichi':           'Kolyadichi, Minsk, Belarus',
}
