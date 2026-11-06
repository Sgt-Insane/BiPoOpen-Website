export const shuffleArray = (array:Array<any>) => {
   for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
   }

   return array;
}

export const convertNumberToCharacter = (num:number) => {
   return num
      .toString()    // convert number to string
      .split('')     // convert string to array of characters
      .map(Number)   // parse characters as numbers
      .map(n => (n || 10) + 64)   // convert to char code, correcting for J
      .map(c => String.fromCharCode(c))   // convert char codes to strings
      .join('');     // join values together
}

// "Heute, 15:37 Uhr" / "Gestern, 21:10 Uhr" / "18.10., 0:04 Uhr" / "18.10.2025, 0:04 Uhr"
export const formatGameTime = (time: number) => {
    const date = new Date(time);
    const now = new Date();
    const clock = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')} Uhr`;

    const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
    if (dayDiff === 0) return `Heute, ${clock}`;
    if (dayDiff === 1) return `Gestern, ${clock}`;

    const day = date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    });
    return `${day}, ${clock}`;
};

// "Jonas Weck" -> "/Spieler/Jonas-Weck", _PlayerProfile.vue macht aus "-" wieder Leerzeichen
export const getPlayerProfilePath = (name: string) => `/Spieler/${encodeURIComponent(name).replaceAll('%20', '-')}`;
