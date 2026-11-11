=== PM Radar – Autoevaluación de Product Manager ===
Version: 0.2.0

Cuestionario de 22 preguntas sobre hechos reales (no autopercepción) que devuelve un radar de capacidad e importancia por área y las 2 áreas donde enfocarse. Sin IA, sin login y sin servidor: todo se calcula en el navegador.

== Instalación ==
1. WordPress → Plugins → Añadir nuevo → Subir plugin → elige pm-radar.zip → Instalar → Activar.
2. En un post o página, añade un bloque "Shortcode" con uno de estos:
   [pm-radar]                 Versión pública.
   [pm-radar discovery="si"]  Versión para entrevistas: pide también "cómo te ves" y añade botones para copiar o descargar los resultados (CSV). La comparación entre percepción y hechos va solo en lo exportado, no se muestra en pantalla.

== Editar preguntas ==
Las preguntas, opciones y áreas están en data/preguntas.json. Cada opción vale 0, 1, 2 o 3 puntos según su posición.
Cada pregunta tiene además: porQue (por qué importa), siguientePaso (3 textos: el que se muestra depende de si respondió la opción 0, 1 o 2) y beneficio (qué gana el PM).
Si cambias preguntas, sube también "version" en ese archivo: así se descartan las respuestas a medias guardadas con la versión anterior.

== Puntuación ==
- Capacidad por área (0-100) = puntos / (3 × preguntas respondidas) × 100. "No aplica" no cuenta.
- Importancia (1-5) se pasa a 0-100: 1=0, 2=25, 3=50, 4=75, 5=100.
- Brecha = importancia − capacidad. Las 2 áreas a mejorar son las de mayor brecha positiva.
- Desempate: menos capacidad; después, más respuestas de 0 puntos.
- Sin brechas positivas: se muestran las 2 áreas con menos capacidad.
- Un área con más de la mitad de preguntas en "No aplica" no se puntúa.

== Colores ==
Edita las variables al principio de assets/pm-radar.css (--pmr-accent, --pmr-imp…).

== Privacidad ==
Las respuestas se guardan solo en el navegador de quien responde (localStorage) para poder continuar si recarga la página. No se envía nada a ningún servidor.
