<template>
  <div class="authentication">
    <Title text="Authentication" :icon="authenticationIcon" />
    <p>Please log in or sign up.</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Title from './Title.vue'; // Import the Title component
import authenticationIcon from '../assets/remote_desktop.png';

export default defineComponent({
  name: 'Authentication',
  components: {
    Title,
  },
  data() {
    return {
      authenticationIcon: authenticationIcon, // Use the imported icon here
    };
  },
});
</script>

<style scoped>
h1 {
  color: darkblue;
}
</style>