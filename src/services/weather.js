const axios = require('axios');

async function getWeather(location) {
  try {
    const url = `https://wttr.in/${encodeURIComponent(location)}?format=%C+%t+%h+%w`;
    const { data } = await axios.get(url, { timeout: 5000 });
    return data;
  } catch {
    return null;
  }
}

async function getWeatherDetailed(location) {
  try {
    const url = `https://wttr.in/${encodeURIComponent(location)}?format=%l:+%C,+%t(+feels+like+%f),+humedad+%h,+viento+%w`;
    const { data } = await axios.get(url, { timeout: 5000 });
    return data;
  } catch {
    return null;
  }
}

module.exports = { getWeather, getWeatherDetailed };
