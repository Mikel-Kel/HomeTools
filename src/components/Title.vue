<template>
  <div class="title-box">
    <!-- Home Icon (only shown if not on the homepage) -->
    <router-link v-if="!isHomePage" to="/" class="home-icon-link">
      <img src="../assets/home.png" alt="Home" class="home-icon" />
    </router-link>

    <!-- Title and Icon -->
    <div class="title-container">
      <img v-if="icon" :src="icon" alt="Title Icon" class="title-icon" />
      <h1>{{ text }}</h1>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { useRoute } from 'vue-router';

export default defineComponent({
  name: 'Title',
  props: {
    text: {
      type: String as PropType<string>,
      required: true,
    },
    icon: {
      type: String as PropType<string>,
      required: false,
    },
  },
  setup() {
    const route = useRoute();
    
    // Check if the current route is the homepage
    const isHomePage = route.path === '/';

    return { isHomePage };
  },
});
</script>

<style scoped>
.title-box {
  background-color: #521a1a;
  color: white; /* White font color */
  padding: 20px;
  border-radius: 15px; /* Rounded corners */
  display: flex;
  align-items: center; /* Center the title and icon vertically */
  justify-content: center;
  position: relative; /* For positioning the home icon */
}

.title-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

h1 {
  margin: 0; /* Remove default margin from h1 */
  font-size: 2em; /* Customize font size */
  font-family: 'Comic Sans MS', sans-serif; /* Apply the custom font */
  font-weight: 700; /* Use bold weight */
}

.title-icon {
  width: 32px; /* Set the icon size */
  height: 32px;
  margin-right: 20px; /* Space between the icon and the title */
}

/* Style for the home icon link */
.home-icon-link {
  position: absolute;
  top: 10px;
  right: 10px;
  text-decoration: none;
}

/* Style for the home icon */
.home-icon {
  width: 16px;
  height: 16px;
}
</style>