import {RouterModule, Routes} from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { AuthGuard } from './auth/guard/auth.guard';

import {NgModule} from '@angular/core';
import {AdminDashboard} from './components/admin-dashboard/admin-dashboard';
import {HomePage} from './components/home-page/home/home-page';
import {ClientDashboard} from './components/client-dashboard/client-dashboard';


export const routes: Routes = [

  { path: 'home', component: HomePage },

  { path: 'login/:org', component: LoginComponent },


  {
    path: 'admin-dashboard',
    component: AdminDashboard,
    canActivate: [AuthGuard]

  },
  {
    path: 'client-dashboard',
    component: ClientDashboard,
    canActivate: [AuthGuard]
  },

  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
