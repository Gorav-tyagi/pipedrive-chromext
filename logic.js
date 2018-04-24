const Airtable = require('airtable');
const app = angular.module("myApp", ["ngSanitize", "ui.bootstrap"]);

app.controller("mainController", ["$scope", "$http", "$uibModal", "$timeout", function($scope, $http, $uibModal, $timeout){
	window.exposedScope = $scope;
	$scope.categories = [{value: 0, name:"CATEGORY"}, {value: 1, name:"ANCHOR/EMCEE"},{value: 2, name:"CELEBRITY"}, {value: 3, name:"COMEDIAN"}, {value:4, name:"DANCER/TROUPE"}, {value:5, name:"DJ"}, {value:6, name:"INSTRUMENTALIST"}, {value:7, name:"LIVE BAND"}, {value:8, name:"MAGICIAN"}, {value:9, name:"MAKE-UP ARTIST"}, {value:10, name:"MODEL"}, {value:11, name:"PHOTOGRAPHER"}, {value:12, name:"SINGER"}, {value:13, name:"SPEAKER"}, {value:14, name:"VARIETY ARTIST"}];
	$scope.pagination = {totalItems: 0, itemsPerPage: 10, currentPage: 1};
	$scope.search = {category: 0, city: "", price: "", subcategory: "Select Subcategory"};
	$scope.sorting = {price: "asc", updated: "asc"};
	$scope.artists = [];
	$scope.alerts = [];

	$scope.subcategoriesMap = {1: ["Select Subcategory", "Anchor/Emcee","Anchor","Emcee","Voice over Artist", "Radio Jockey"], 2:["Select Subcategory","Celebrity", "Film Stars", "Sports Celebrities","TV Personalities","Pageant Winner"], 3: ["Select Subcategory","Comedian","Stand Up","Impersonators","Mimicry","Reality Show Comedians"], 4: ["Select Subcategory","Dancer/Troupe","Belly Dancers","Exotic Dancers","Bhangra","Bollywood","Choreographers","Indian Classical","Kids Troupe","Folk","Religious","Reality Show Dancers","Western"], 5: ["Select Subcategory","DJ","Techno","EDM","Trance","Bollywood","Rock","Dubstep","Deep House","Minimal", "VDJ","Electro","Progressive","Psychedelic","Trap","Bass"], 6:["Select Subcategory","Instrumentalist","Guitarist","Percussionist","Flutist","Pianist","Saxophonist","Keyboardist","Violinist","Indian Classical Instruments","One-man band"],7: ["Select Subcategory","Live Band","Sufi","Bollywood","Rock","Fusion","Pop","Jazz","Metal","Orchestra","Blues","Folk","Indie","Tribute","Alternative","Punk","Funk","Progressive","Psychedelic","Electronica","Rock n Roll","Reggae","Rap","Hip Hop"], 8: ["Select Subcategory","Magician","Stage Magicians","Illusionist","Close up Magicians","Hypnotist","Mind Reader"], 9: ["Select Subcategory","Make-up Artist","Fashion","Bridals & Parties","Film & Television","Wardrobe Stylist","Fashion Choreographer"], 10:["Select Subcategory","Model","Runway Models","Catalogue Models","Commercial Models","Glamour Models","Art Models","Promotional Models","Foreign Models","International Models"], 11: ["Select Subcategory","Photographer","Wedding","Baby","Candid","Concept","Corporate Films","Documentary Films","Events","Fashion","Short Films","Portfolio","Weddings","Portrait","Product"],12:["Select Subcategory","Singer","Bollywood","Classical","English Retro","Ghazal","Hindi Retro","Indian Folk","Karaoke","Qawwali","Religious","Acoustic Singer","Rapper"],13: ["Select Subcategory","Speaker","Motivational","Vocational","Spiritual","Training"],14: ["Select Subcategory","Variety Artist","Acrobat Artists","Balloon Artists","Bartenders","Caricaturists","Painters","Fire Artists","Jugglers","Mehendi Artists","Puppeteers","Stilt Walkers","Stunt Artists","Shadow Artists","Sand Artists","Whistler","Beatboxer"]};
	$scope.subcategories = ["Select Subcategory"];

	$scope.generes = [{value: 0, name:"Select Genere"}, {value: 1, name:"Male"}, {value: 2, name: "Female"}, {value: 3, name: "Others"}];
	$scope.subscriptions = ["Select Subscription", "Get Discovered", "Instant Gigs", "Power Up"];
	$scope.languages = ["Select Language", "English","Hindi","Punjabi","Gujarati","Bengali","Malayalam","Marathi","Tamil","Telugu","Kannada","Assamese","Rajasthani"];

	$scope.categoryChange = function(){
		$scope.subcategories = $scope.subcategoriesMap[$scope.search.category] || ["Select Subcategori"];
	}

	$scope.closeAlert = (index) => {
		if(index < $scope.alerts.length){
			$scope.alerts.splice(index, 1);
		}
	}

	$scope.changeSorting = (key) => {
		if($scope.sorting[key] === "asc"){
			$scope.sorting[key] = "desc";
		}else{
			$scope.sorting[key] = "asc";
		}
		$scope.loadArtists();
	}

	$scope.showTokensModal = () => {
		let instance = $uibModal.open({
	      templateUrl: 'tokensModal.html',
	      backdrop: "static",
	      controller: 'tokensController',
	      size: "sm",
	      resolve: {
	        PIPEDRIVE_TOKEN: () => $scope.PIPEDRIVE_TOKEN,
	        AIRTABLE_TOKEN: () => $scope.AIRTABLE_TOKEN
		  }
		}).result.then(tokens => {
			if(tokens && tokens.pipedriveToken && tokens.airtableToken){
				$scope.AIRTABLE_TOKEN = tokens.airtableToken;
				$scope.PIPEDRIVE_TOKEN = tokens.pipedriveToken;

				if($scope.AIRTABLE_TOKEN){
					$scope.airtable = new Airtable({apiKey: $scope.AIRTABLE_TOKEN}).base("appAOUimmyFijLDUZ");
				}

				Utils.setPipedriveToken(tokens.pipedriveToken);
				Utils.setAirtableToken(tokens.airtableToken);

				$scope.loadDeal();
			}
		});
	}

	$scope.pagination.onPageChange = () => {
		$scope.artistsToShow = $scope.artists.slice(($scope.pagination.currentPage - 1) * $scope.pagination.itemsPerPage, Math.min($scope.pagination.currentPage * $scope.pagination.itemsPerPage, $scope.artists.length));
		$scope.saveState();
	}

	$scope.loadArtists = state => {
		$scope.pagination.loading = true;
		$scope.alerts = $scope.alerts.filter(a => a.type !== "ARTISTS");
		$scope.artists = [];
		$scope.pagination.currentPage = 1;
		$scope.pagination.totalItems = 0;
		$scope.loadMoreArtists = undefined;
		$scope.artistsToShow = [];

		let options = {
						view: "TestView",
		    			fields: ["id", "professionalname", "price", "city", "email", "phone", "subcategory", "url", "thumbnail", "updated"],
		    			sort: [{field: "price", direction: $scope.sorting.price}, {field: "updated", direction: $scope.sorting.updated}]
		    		}

		let categoryObj = $scope.categories.find(c => c.value != 0 && c.value == $scope.search.category);
		let conditions = [];
		let filterByFormula = "";
		if(categoryObj){
			conditions.push(`FIND("${categoryObj.name.toLowerCase()}", LOWER(category))`);
		}
		if($scope.search.city && $scope.search.city.trim()){
			conditions.push(`FIND("${$scope.search.city.toLowerCase()}", LOWER(city))`);
		}
		if($scope.search.price === 0 || ($scope.search.price && !isNaN($scope.search.price))){
			conditions.push(`price<=${$scope.search.price}`);
		}

		if(conditions.length){
			if(conditions.length === 1){
				filterByFormula = conditions[0];
			}else{
				filterByFormula = `AND(${conditions.join()})`;
			}
		}
		options.filterByFormula = filterByFormula;
		$scope.airtable("ArtistsDev")
		.select(options)
		.eachPage(function(records, fetchNextPage) {
			$timeout(() => {
				$scope.loadMoreArtists = fetchNextPage;
				$scope.artists.push(...records.map(v => {
					let artist = {...v.fields, rowId: v.fields.id, id: v.id};
					if(state && state.artists){
						artist.checked = (state.artists.find(a => a.id === artist.id) || {}).checked;
					}
					return artist;
				}));

				let start = 0;
				let end = $scope.itemsPerPage;
				if(state && state.currentPage && ((state.currentPage - 1) * $scope.pagination.itemsPerPage) < $scope.artists.length){
					$scope.pagination.currentPage = state.currentPage;
					start = (state.currentPage - 1) * $scope.pagination.itemsPerPage;
					end = Math.min($scope.artists.length, state.currentPage * $scope.pagination.itemsPerPage);
				}
				if(state && state.artists && $scope.artists.length < state.artists.length && $scope.loadMoreArtists){
					$scope.loadMoreArtists();
				}

				$scope.artistsToShow = $scope.artists.slice(start, end);
				$scope.pagination.totalItems = $scope.artists.length;
				$scope.pagination.loading = false;
				if(!state){
					$scope.saveState();
				}
			});
		}, function done(error) {
			$timeout(() => {
				$scope.loadMoreArtists = undefined;
				if(error){
					$scope.alerts.push({type: "ARTISTS", msg: "Unable to load artists. Make sure the AirTable token is valid."});
				}
				$scope.pagination.loading = false;
			});
		});
	}


	$scope.loadDeal = dealId => {
		let loadDeal = () => {
			if($scope.dealId){
				$scope.pagination.loading = true;
				$scope.alerts = $scope.alerts.filter(a => a.type !== "DEAL");
				$http.get(`https://api.pipedrive.com/v1/deals/${$scope.dealId}?api_token=${$scope.PIPEDRIVE_TOKEN}`).then(r => r.data).then(r => r.data).then(data => {
					$scope.search.category = parseInt(data["61a501536a4065f5a970be5c6de536cf7ad14078"]);
					$scope.search.price = data.value;
					$scope.search.city = data["361085abd375a7eb3964f068295f12fe17d9f280_admin_area_level_2"];
					$scope.search.name = data["ef1b3ca0c720a4c39ddf75adbc38ab4f8248597b"];
					$scope.loadArtists();
					$scope.pagination.loading = false;
				}).catch(e => {
					$scope.pagination.loading = false;
					$scope.alerts.push({type:"DEAL", msg: `Unable to get deal "${$scope.dealId}" details. Make sure the PipeDrive token is valid.`});
				});
			}else{
				$scope.loadArtists();
			}
		}
		
		if(dealId){
			$scope.dealId = dealId;
			loadDeal();
		}else{
			Utils.getDealId(dealId => {
				$timeout(() => {
					$scope.dealId = dealId;
					loadDeal();
				});
			});
		}
	}

	Utils.getPipedriveToken(token => {
		$timeout(() => {
			$scope.PIPEDRIVE_TOKEN = token;
		});
		Utils.getAirtableToken(token => {
			$timeout(() => {
				$scope.AIRTABLE_TOKEN = token;

				if($scope.AIRTABLE_TOKEN){
					$scope.airtable = new Airtable({apiKey: $scope.AIRTABLE_TOKEN}).base("appAOUimmyFijLDUZ");
				}

				if($scope.PIPEDRIVE_TOKEN && $scope.AIRTABLE_TOKEN){
					//$scope.loadDeal();
					Utils.getDealId(dealId => {
						Utils.getState(state => {
							$timeout(() => {
								if(state){
									if(state.search){
										$scope.search = state.search;
									}
									if(state.sorting){
										$scope.sorting = state.sorting;
									}
									$scope.dealId = dealId;
								}
								$scope.loadArtists(state);
							});
						});
					});
				}else{
					$scope.showTokensModal();
				}
			});
		});
	});

	$scope.submitArtists = () => {
		let artists = $scope.artists.filter(a => a.checked).map(a => a.id);
		let categoryName = ($scope.categories.find(c => c.value == $scope.search.category) || {}).name
		let json = {
			fields:{
				dealid: parseInt($scope.dealId),
				artists,
			}
		}
		$http({
			method: "POST",
			url: "https://api.airtable.com/v0/appAOUimmyFijLDUZ/ArtistSuggest",
			headers: {
				"Authorization": `Bearer ${$scope.AIRTABLE_TOKEN}`
			},
			data: json
		}).then(response => {
			console.info("Artists were posted", response);
		}).catch(e => {
			console.warn("Unable to posts checked artists", e);
			$scope.alerts.push({type: "ARTISTS", msg: "Unable to POST selected artists"});
		});
		
	}

	$scope.restoreState = () => {
		Utils.getState(state => {

		});
	}

	$scope.saveState = () => {
		let state = {artists: $scope.artists.map(a => ({id: a.id, checked: a.checked})), currentPage: $scope.pagination.currentPage, search: $scope.search, sorting: $scope.sorting};
		Utils.setState(state);
	}

}]);

app.controller("tokensController", ["$scope", "$uibModalInstance", "PIPEDRIVE_TOKEN", "AIRTABLE_TOKEN", function($scope, $uibModalInstance, PIPEDRIVE_TOKEN, AIRTABLE_TOKEN){
	$scope.local = {pipedriveToken: PIPEDRIVE_TOKEN, airtableToken: AIRTABLE_TOKEN, pipedriveTokenHasError: false, airtableTokenHasError: false};
	if(!$scope.local.pipedriveToken){
		Utils.getTempPipedriveToken(token => {
			$scope.local.pipedriveToken = token;
		})
	}
	if(!$scope.local.airtableToken){
		Utils.getTempAirtableToken(token => {
			$scope.local.airtableToken = token;
		});
	}
	$scope.local.setPipedriveToken = () => {
		Utils.setTempPipedriveToken($scope.local.pipedriveToken);
	}
	$scope.local.setAirtableToken = () => {
		Utils.setTempAirtableToken($scope.local.airtableToken);
	}
	$scope.local.save = () => {
		if($scope.local.pipedriveToken && $scope.local.airtableToken){
			$uibModalInstance.close({pipedriveToken: $scope.local.pipedriveToken, airtableToken: $scope.local.airtableToken});
		}else{
			if(!$scope.local.pipedriveToken){
				$scope.local.pipedriveTokenHasError = true;
			}
			if(!$scope.local.airtableToken){
				$scope.local.airtableTokenHasError = true;
			}
		}
	}
}]);
