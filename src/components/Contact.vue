<template>
  <div>
    <Title text="Contacts" icon="home.png" />  

    <!-- Liste des contacts -->
    <ul>
      <li v-for="contact in contacts" :key="contact.id">
        {{ contact.name }} - {{ contact.email }}
      </li>
    </ul>

    <!-- Formulaire d'ajout -->
    <form @submit.prevent="addContact">
      <input
        type="text"
        v-model="newContact.name"
        placeholder="Name"
        required
      />
      <input
        type="email"
        v-model="newContact.email"
        placeholder="Email"
        required
      />
      <button type="submit">Add Contact</button>
    </form>
    <!-- Add some space between the form and the back button -->
    <div class="spacer"></div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import Title from './Title.vue';
import axios from 'axios';
import { Contact } from '../Types';

export default defineComponent({
  name: 'Contact',
  components: {
      Title
    },
  setup() {
    const contacts = ref<Contact[]>([]);
    const newContact = ref({ name: '', email: '' });

    const fetchContacts = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/contacts');
        contacts.value = response.data;
      } catch (error) {
        console.error('Error fetching contacts:', error);
      }
    };

    const addContact = async () => {
      try {
        const response = await axios.post('http://localhost:3000/api/contacts', newContact.value);
        contacts.value.push(response.data);
        newContact.value = { name: '', email: '' }; // Réinitialiser le formulaire
      } catch (error) {
        console.error('Error adding contact:', error);
      }
    };

    onMounted(fetchContacts);

    return { contacts, newContact, addContact };
  },
});
</script>

<style scoped>
h1 {
  color: darkgreen;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  margin-bottom: 10px;
}

form {
  margin-top: 20px;
}

input {
  margin-right: 10px;
  padding: 5px;
}

/* Space between the form and the back button */
.spacer {
  margin-top: 20px;
}

button:hover {
  background-color: #0056b3;
}
</style>