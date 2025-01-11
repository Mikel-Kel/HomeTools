import { createRouter, createWebHistory } from 'vue-router';

  const Authentication = () => import('../components/Authentication.vue');
  const Spending = () => import('../components/Spending.vue');
  const Contact = () => import('../components/Contact.vue');
  const Allocation = () => import('../components/Allocation.vue');

  const routes = [
    {
      path: '/',
      component: () => import('../components/Homepage.vue'), // Home page
      meta: { title: 'Home' },
    },
    {
      path: '/authentication',
      component: () => import('../components/Authentication.vue'), // Contact page
      meta: { title: 'Authentication' },
    },
    {
      path: '/spending',
      component: () => import('../components/Spending.vue'), // Contact page
      meta: { title: 'Spending' },
    },
    {
      path: '/contact',
      component: () => import('../components/Contact.vue'), // Contact page
      meta: { title: 'Contact' },
    },
    {
      path: '/allocation/:record',
      name: 'allocation',
      component: Allocation,
      props: true,  // This ensures that the `record` from the route params is passed as a prop to the Allocation component
      },
  ];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Update the document title dynamically
router.beforeEach((to: any, from: any, next: any) => {
  document.title = (to.meta && to.meta.title) ? to.meta.title : 'HomeTools';
  next();
});

export default router;