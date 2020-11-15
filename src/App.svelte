<script>
  import HowTo from "./HowTo.svelte";
  import Timer from "./Timer.svelte";
  let audio;
  function timerEnds(e) {
    audio.play();
  }
</script>

<style>
  h1,
  h3 {
    text-align: center;
  }
</style>

<h1>Handwashing App</h1>

<Timer on:end={timerEnds} />
<HowTo />

<h3>
  <a
    href="https://www.youtube.com/redirect?event=video_description&v=ujbE0mzX-CU&q=https%3A%2F%2Fwww.who.int%2Fgpsc%2Fclean_hands_protection%2Fen%2F&redir_token=QUFFLUhqa1F5V3JKNTYxN2VOWms2NmpHY3Ftczc3a1pfQXxBQ3Jtc0trUVRiUDQwOERpWUhsNEszQUtpN2pFcjhGcUk4NU1WYVdCSUphZjV2dmNoOEZGcWNBU3pXdUxpUC1TdWJyRkZzQ3VEUjljdEhOekdRV1BGem5wZGZsZzhicl9vVTZYQ01vWjk3cHZfQ2NiWGVfLUZqSQ%3D%3D" />
</h3>

<audio bind:this={audio}>
  <source src="sound.wav" />
</audio>
