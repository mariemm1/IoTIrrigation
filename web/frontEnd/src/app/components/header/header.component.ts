import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  @Input() orgName = 'Organization';
  @Input() userName = 'User';
  @Input() menuOpen = false;

  @Output() searchChange = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
  @Output() toggleMenu = new EventEmitter<void>();
  @Output() goProfile = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  query = '';

  onInput() {
    this.searchChange.emit(this.query);
  }
}
