/* ... (решта коду без змін до updateCurrentStationInfo) ... */

function updateCurrentStationInfo(item) {
  if (!currentStationInfo) {
    console.error("currentStationInfo не знайдено");
    return;
  }
  const stationNameElement = currentStationInfo.querySelector(".station-name");
  const stationGenreElement = currentStationInfo.querySelector(".station-genre");
  const stationCountryElement = currentStationInfo.querySelector(".station-country");

  if (stationNameElement) {
    stationNameElement.textContent = item.dataset.name || "Unknown";
    stationNameElement.classList.toggle("hidden", !item.dataset.name);
  }
  if (stationGenreElement) {
    stationGenreElement.textContent = item.dataset.genre ? `Genre: ${item.dataset.genre}` : "";
    stationGenreElement.classList.toggle("hidden", !item.dataset.genre);
  }
  if (stationCountryElement) {
    stationCountryElement.textContent = item.dataset.country ? `Country: ${item.dataset.country}` : "";
    stationCountryElement.classList.toggle("hidden", !item.dataset.country);
  }
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Unknown Station",
      artist: `${item.dataset.genre || "Unknown"} | ${item.dataset.country || "Unknown"}`,
      album: "Radio Music"
    });
  }
}

/* ... (решта коду без змін) ... */