import { Directive, Input, ElementRef, AfterViewInit } from '@angular/core';

@Directive({
  selector: '[appMapReady]',
  standalone: true
})
export class MapReadyDirective implements AfterViewInit {
  @Input('appMapReady') handler?: (el: HTMLDivElement) => void;
  constructor(private el: ElementRef<HTMLDivElement>) {}
  ngAfterViewInit() { this.handler?.(this.el.nativeElement); }
}
