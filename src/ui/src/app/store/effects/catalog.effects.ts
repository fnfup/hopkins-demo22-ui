import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { select, Store } from "@ngrx/store";
import { of } from "rxjs";
import { catchError, map, mergeMap, switchMap, withLatestFrom } from "rxjs/operators";
import { UpdateRequestFilters } from "src/app/lib/helpers/filter.operator";
import { MusicArtist, MusicCatalogDto, MusicGenre } from "src/app/lib/models/catalog.models";
import { LibraryStatusRequestDto } from "src/app/lib/models/library.models";
import { RequestApiService } from "src/app/services/request.service";
import { AppActions } from "../actions/app.actions";
import { IAppState } from "../models/appstate.model";
import { selectAppliedFilters } from "../selectors/selectors";


@Injectable()
export class CatalogEffects {

    constructor(
        private actions$: Actions,
        private store: Store<IAppState>,
        private apiService: RequestApiService) { }

    searchCatalogEffect$ = createEffect(() => this.actions$
        .pipe(
            ofType(AppActions.SearchMusicCatalog),
            map(action => action.filter),
            withLatestFrom(this.store.pipe(select(selectAppliedFilters))),
            UpdateRequestFilters,
            switchMap(filters => this.apiService.searchMusicCatalog(filters)),
            mergeMap(results => {
                const trackIds = (<MusicCatalogDto>results)
                    .music.map(t => t.id);

                let request: LibraryStatusRequestDto = {
                    userId: 2,
                    trackIds: trackIds
                };

                return [
                    AppActions.UpdateMusicCatalog({ musicCatalog: (<MusicCatalogDto>results) }),
                    AppActions.RequestLibraryStatus({ request: request })
                ]
            }),
            catchError((err, originalObs$) => {
                console.log(err);
                // this allows us to continue processing events
                return originalObs$
            })
        ), { dispatch: true });


        requestAvailableArtists$ = createEffect(() => this.actions$.pipe(
            ofType(AppActions.RequestAvailableArtists),
            switchMap(() => this.apiService.getArtists()),
            mergeMap(results => {
                return of(
                    AppActions
                    .UpdateArtistList({ artists: <MusicArtist[]>results }));
            }),
            catchError((err, originalObs$) => {
                console.log(err);
                // this allows us to continue processing events
                return originalObs$
            })
        ), { dispatch: true });

        requestAvailableGenres$ = createEffect(() => this.actions$.pipe(
            ofType(AppActions.RequestAvailableGenres),
            switchMap(() => this.apiService.getGenres()),
            mergeMap(results => {
                return of(
                    AppActions
                    .UpdateGenreList({ genres: <MusicGenre[]>results }));
            }),
            catchError((err, originalObs$) => {
                console.log(err);
                // this allows us to continue processing events
                return originalObs$
            })
        ), { dispatch: true });

}