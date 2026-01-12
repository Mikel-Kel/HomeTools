<template>
  <div class="authentication">
    <Title text="Authentication" icon="remote_desktop.png" />
    <p>Please log in or sign up.</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Title from './AppTitle.vue'; // Import the Title component

export default defineComponent({
  name: 'Authentication',
  components: {
    Title,
  },
});
</script>

<style scoped>
h1 {
  color: darkblue;
}
</style>