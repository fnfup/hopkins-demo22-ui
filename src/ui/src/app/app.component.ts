import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { select, Store } from '@ngrx/store';
import * as _ from 'lodash';
import { EMPTY, of } from 'rxjs';
import { UserMusic } from './lib/models/library.models';
import { MusicTrack } from './lib/models/catalog.models';
import { AppActions } from './store/actions/app.actions';
import { IAppState } from './store/models/appstate.model';
import { appStateSelector, selecMusicCatalog, selectAuthEventStatus, selectUserLibrary } from './store/selectors/selectors';
import { MusicOrderDto } from './lib/models/order.models';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { catchError, filter, mergeMap, take, tap, withLatestFrom } from 'rxjs/operators';
import { EventMessage, EventType } from '@azure/msal-browser';
import { Deserialize } from './lib/helpers/deserialize';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  title = 'Angular 13 + Spring Boot + MSSQL + Azure';

  data: IAppState = <any>{
    "initial": "just a start"
  };

  isIframe = window !== window.parent && !window.opener;

  isAuthenticated = false;

  constructor(
    private store: Store<IAppState>,
    private cdr: ChangeDetectorRef,
    private auth: MsalService,
    private authEvents: MsalBroadcastService) {
  }

  ngOnInit() {
    // Log auth events to the store
    this.authEvents.msalSubject$
      .pipe(
        tap((event: EventMessage) => {
          this.store.dispatch(
            AppActions.UpdateAuthEventStatus({ authEvent: Deserialize(event) }));
        })
      ).subscribe();

    this.streamAppState();

    this.streamAuthFlow();
  }

  streamAuthFlow() {
    // avoid sending api request before auth
    this.store.pipe(
      select(selectAuthEventStatus),
      filter((event: EventMessage) =>
        !!event && event.eventType == EventType.HANDLE_REDIRECT_END),
      take(1),
      tap(ev => {
        this.isAuthenticated = this.auth.instance.getAllAccounts().length > 0;

        if (this.isAuthenticated) {
          const authentiatedUser = this.auth.instance.getAllAccounts()[0];
          this.store.dispatch(
            AppActions.UpdateActiveUserDetails(
              { userDetails: Deserialize(authentiatedUser) }));
        }

        this.cdr.detectChanges();

        this.store.dispatch(
          AppActions.SearchMusicCatalog({ filter: {} }))
      })
    ).subscribe();
  }

  streamAppState() {
    this.store.pipe(
      select(appStateSelector),
      tap(state => {
        this.data = state;
        console.log('updating data state');
        this.cdr.detectChanges();
      })
    ).subscribe();
  }

  public submitApiRequest(option: number) {
    console.log('option received: ' + option);
    switch (option) {
      case 1:
        let randomArtists = this.getRandomEntityId(1, 8, 3);
        this.store.dispatch(
          AppActions.SearchMusicCatalog({
            filter: {
              artist: randomArtists
            }
          }))
        break;
      case 2:
        this.store.dispatch(
          AppActions.RequestAvailableArtists())
        break;
      case 3:
        this.store.dispatch(
          AppActions.RequestAvailableGenres())
        break;
      case 4:
        this.store.dispatch(
          AppActions.RequestUserLibrary({ userId: 2 }))
        break;
      case 5:
        this.store.dispatch(
          AppActions.RequestOrderHistory({ userId: 2 }))
        break;
      case 6:
        this.store.pipe(
          select(selectUserLibrary),
          withLatestFrom(this.store.select(selecMusicCatalog)),
          take(1),
          mergeMap(data => {
            // debugging
            let safeToTest = !!data[0] && !!data[1]
              && data[0].count > 0 && data[1].count == 28;

            if (!!data[0] && !!data[1]
              && data[0].count > 0 && data[1].count == 28) {

              let orderItems = this.getRandomFromSet(4,
                data[1]?.music, data[0]?.library);
              return of({ valid: true, items: orderItems });
            } else {
              console.log("Not safe to generate random order; " +
                "Please refresh, load user library and try again.");
              return of(<any>{ valid: false, items: [] });
            }
          }),
          tap(orderData => {
            let result = (<{ valid: false, items: [] }>orderData);
            if (result.valid) {
              let order: MusicOrderDto = {
                items: result.items,
                userId: 2
              };
              this.store.dispatch(
                AppActions.SubmitOrder({ payload: order }));
            }
          }),
          catchError(err => EMPTY)
        ).subscribe();


        // this.store.dispatch(
        //   AppActions.SubmitOrder({}))
        break;
    }
  }

  private getRandomEntityId(
    min: number, max: number, count: number): number[] {

    let set = new Set<number>();
    let iterations = 0;

    while (set.size < count && iterations < 1000) {
      iterations++;
      let num = Math.round(Math.random() * (max - min) + min);
      set.add(num)
    }

    let results: number[] = [];
    set.forEach(v => results.push(v));

    return results;
  }

  private getRandomFromSet(count: number,
    catalog: MusicTrack[], userLib: UserMusic[]): number[] {

    let orderList: number[] = [];

    let uniqueSet: MusicTrack[] = catalog.filter(
      track => {
        let match = userLib.find(lib => track.id == lib.track.id);
        return !!match ? false : true;
      }
    );

    let filteredIds = uniqueSet.map(t => t.id);

    for (let i = 0; i < count; i++) {
      let max = filteredIds.length;
      let randomIndex = Math.round(Math.random() * max);
      orderList.push(filteredIds[randomIndex]);
      filteredIds.splice(randomIndex, 1);
    }

    return orderList;
  }

}
