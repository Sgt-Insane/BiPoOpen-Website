import { createRouter, createWebHistory } from 'vue-router'
import { CURRENT_SEASON_SLUG } from '@/components/frontend/league/LeagueSeasonsData'

const routes = [
	// Frontend
	{
		path: '/',
		name: 'Home',
		component: () => import('@/components/frontend/home/_Home.vue'),
		meta: {
			title: 'Weck BiPo Open',
			description: ''
		}
	},
	{
		path: '/Regeln',
		name: 'Regeln',
		component: () => import('@/components/frontend/_Rules.vue'),
		meta: {
			title: 'Weck BiPo Open - Regeln',
			description: 'Regeln'
		}
	},

	// Offene Spiele haben keine eigene Seite mehr, eingetragen wird ueber das Plus in der Navigation
	{
		path: '/Offene-Spiele',
		redirect: '/'
	},

	{
		path: '/Nackte-Meilen',
		name: 'Nackte Meilen',
		component: () => import('@/components/frontend/nackteMeilen/_NackteMeilen.vue'),
		meta: {
			title: 'Weck BiPo Open - Nackte Meilen',
			description: 'Nackte Meilen'
		}
	},

	{
		path: '/Weltrangliste',
		name: 'Weltrangliste',
		component: () => import('@/components/frontend/worldRanking/_WorldRanking.vue'),
		meta: {
			title: 'Weck BiPo Open - Weltrangliste',
			description: 'Weltrangliste'
		}
	},

	{
		path: '/Hall-of-Fame',
		name: 'Hall Of Fame',
		component: () => import('@/components/frontend/_HallOfFame.vue'),
		meta: {
			title: 'Weck BiPo Open - Hall of Fame',
			description: 'Hall of Fame'
		}
	},

		{
		path: '/Knecht',
		name: 'BiPo-Knecht',
		component: () => import('@/components/frontend/biPoKnecht/_BiPoKnecht.vue'),
		meta: {
			title: 'Weck BiPo Knecht',
			description: 'BiPo Knecht'
		}
	},


	{
		path: '/BiPo-League',
		redirect: '/League'
	},

	{
		path: '/League',
		redirect: () => `/League/${CURRENT_SEASON_SLUG}`
	},

	{
		path: '/League/:Season/:League?',
		name: 'BiPo League',
		component: () => import('@/components/frontend/league/_League.vue'),
		meta: {
			title: 'Weck BiPo League',
			description: 'BiPo League'
		}
	},

	

	{
		path: '/Spieler/:PlayerName',
		name: 'Spieler Profil',
		component: () => import('@/components/frontend/playerProfile/_PlayerProfile.vue'),
		meta: {
			title: 'Weck BiPo Open - Spieler Profil',
			description: 'Spieler Profil'
		}
	},

	// Detailseite: mobil ohne App-Header, mit Zurueck-Pfeil (App.vue)
	{
		path: '/Benachrichtigungen',
		name: 'Benachrichtigungen',
		component: () => import('@/components/frontend/notifications/_Notifications.vue'),
		meta: {
			title: 'Weck BiPo Open - Benachrichtigungen',
			description: 'Benachrichtigungen',
			detailPage: true
		}
	},

	// Frontend - Tournament
	{
		path: '/:TournamentName',
		name: 'Tournament',
		component: () => import('@/components/frontend/tournament/_Tournament.vue'),
		children: [
			{
				path: 'Teams',
				component: () => import('@/components/frontend/tournament/_Tournament.vue'),
				meta: {
					title: 'Weck BiPo Open - REPLACE - Teams',
					description: 'Tournament'
				}
			},
			{
				path: 'MVP',
				component: () => import('@/components/frontend/tournament/_Tournament.vue'),
				meta: {
					title: 'Weck BiPo Open - REPLACE - MVP',
					description: 'Tournament'
				}
			},
			{
				path: 'Gruppenphase',
				component: () => import('@/components/frontend/tournament/_Tournament.vue'),
				meta: {
					title: 'Weck BiPo Open - REPLACE - Gruppenphase',
					description: 'Tournament'
				}
			},
			{
				path: 'K.o.Phase',
				component: () => import('@/components/frontend/tournament/_Tournament.vue'),
				meta: {
					title: 'Weck BiPo Open - REPLACE - K.o.Phase',
					description: 'Tournament'
				}
			},
			{
				path: 'Fotos',
				component: () => import('@/components/frontend/tournament/_Tournament.vue'),
				meta: {
					title: 'Weck BiPo Open - REPLACE - Fotos',
					description: 'Tournament'
				}
			},
			// {
			// 	path: 'Anmeldung',
			// 	component: () => import('@/components/frontend/_Teamanmeldung.vue'),
			// 	meta: {
			// 		title: 'Weck BiPo Open 2026 - Anmeldung',
			// 		description: 'Anmeldung'
			// 	}
			// }
		],
		meta: {
			title: 'Weck BiPo Open - REPLACE',
			description: 'Tournament'
		}
	},
	
	// Redirect
	{
		path: '/Spielplan',
		redirect: '/2026/Gruppenphase'
	},

	/////////////
	// Backend //
	/////////////
	{
		path: '/Manage',
		name: 'Manage',
		component: () => import('@/components/backend/routes/_Manage.vue'),
		meta: {
			title: 'Weck BiPo Open - Backend',
			description: ''
		}
	},
	{
		path: '/Manage/Tournaments',
		name: 'Manage Tournaments',
		component: () => import('@/components/backend/routes/_ManageTournaments.vue'),
		meta: {
			title: 'Weck BiPo Open - Tournaments Backend',
			description: ''
		}
	},
	{
		path: '/Manage/Tournaments/:TournamentName',
		name: 'Manage Tournament',
		component: () => import('@/components/backend/routes/_ManageSingleTournament.vue'),
		meta: {
			title: 'Weck BiPo Open REPLACE - Backend',
			description: ''
		}
	},
	{
		path: '/Manage/OpenGames',
		name: 'Manage Open Games',
		component: () => import('@/components/backend/routes/_ManageOpenGames.vue'),
		meta: {
			title: 'Weck BiPo Open - Manage Open Games',
			description: ''
		}
	},
	{
		path: '/Manage/LeagueGames',
		name: 'Manage League Games',
		component: () => import('@/components/backend/routes/_ManageLeagueGames.vue'),
		meta: {
			title: 'Weck BiPo Open - Manage League Games',
			description: ''
		}
	},
	{
		path: '/Manage/LeagueCup',
		name: 'Manage League Cup',
		component: () => import('@/components/backend/routes/_ManageLeagueCup.vue'),
		meta: {
			title: 'Weck BiPo Open - Manage League Cup',
			description: ''
		}
	},
	{
		path: '/Manage/Anmeldungen',
		name: 'Manage Anmeldungen',
		component: () => import('@/components/backend/routes/_ManageRegistrations.vue'),
		meta: {
			title: 'Weck BiPo Open - Anmeldungen Backend',
			description: ''
		}
	},
	
	// 404
	{
		path: "/:catchAll(.*)",
		name: "NotFound404",
		component: () => import('@/components/frontend/_NotFound404.vue'),
		meta: {
			title: 'Weck BiPo Open - 404',
			description: '404 Seite nicht gefunden'
		}
	},

	{
		path: '/Impressum',
		name: 'Impressum',
		component: () => import('@/components/frontend/_Imprint.vue'),
		meta: {
			title: 'Weck BiPo Open - Impressum',
			description: 'Impressum'
		}
	},

	{
		path: '/Hall-of-Fame-SCW',
		name: 'Hall Of Fame SCW',
		component: () => import('@/components/frontend/_HallOfFameSCW.vue'),
		meta: {
			title: 'Weck BiPo Open - Hall of Fame SCW',
			description: 'Hall of Fame SCW'
		}
	}

];

const router = createRouter({
	history: createWebHistory(),
	routes: routes,
	scrollBehavior() {
		return { top: 0 }
	}
});

router.beforeEach((to, from, next) => {
	let title = (to.meta.title as string).replace("REPLACE", to.params.TournamentName as string)
	document.title = title;
	(document.querySelector("meta[property='og:title']")as HTMLMetaElement).content = title;
	
	let description = (to.meta.description as string).replace("REPLACE", to.params.TournamentName as string);
	(document.querySelector("meta[name=description]") as HTMLMetaElement).content = description;
	(document.querySelector("meta[property='og:description']")as HTMLMetaElement).content = description;

	next();
});

export default router;
