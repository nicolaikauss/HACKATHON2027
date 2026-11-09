import { useEffect, useState } from 'react';
import signals from '../data/signals.json';

const nextFriday = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The chance of rain next Friday in Torino, from 0 to 100. Live, with a saved value if the request fails. */
export function useFridayRain() {
  const [rain, setRain] = useState<number | null>(signals.weather?.find((w) => w.date === nextFriday())?.rainProb ?? null);
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=45.07&longitude=7.69&daily=precipitation_probability_max&timezone=Europe%2FRome&forecast_days=8')
      .then((r) => r.json())
      .then((d) => {
        const i = d.daily.time.indexOf(nextFriday());
        if (i >= 0) setRain(d.daily.precipitation_probability_max[i]);
      })
      .catch(() => {});
  }, []);
  return rain;
}
