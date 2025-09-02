import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {AuthService} from './services/authService/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('iot-irrigation-dashboard');

  constructor(private authService: AuthService) {}


  ngOnInit() {
    this.authService.loadToken();  // Charger le token dès le démarrage
  }
}
