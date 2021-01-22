<script>
  import HowTo from "./HowTo.svelte";
  import Timer from "./Timer.svelte";
  import Timer2Tween from "./Timer2Tween.svelte";

  let audio;
  function timerEnds() {
    audio.play();
  }
</script>

<style>
  h1,
  h3 {
    text-align: center;
  }
</style>

<h1>Handwashing App (Store & Tweened Async Progress Bar Version)</h1>
<Timer2Tween on:end={timerEnds} />
<HowTo />

<h1>Handwashing App (Original Tutorial Version)</h1>
<Timer on:end={timerEnds} />
<HowTo />
<h3>
  <a href="https://www.who.int/gpsc/clean_hands_protection/en/">
    Picture Source
  </a>

  <a href="https://freesound.org/people/metrostock99/sounds/345086/ ">
    Sound Source
  </a>
</h3>
<audio bind:this={audio}>
  <track kind="captions" />
  <source src="sound.wav" />
</audio>
