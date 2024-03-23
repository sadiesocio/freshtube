var apiChannelURL = "https://www.googleapis.com/youtube/v3/channels?part=contentDetails";
var apiPlaylistURL = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet";
var apiDurationURL = "https://www.googleapis.com/youtube/v3/videos?part=contentDetails";
var apiLiveBroadcastURL = "https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails";
var watchURL = "https://www.youtube.com/watch";

var channelRe = /youtube\.com\/channel\/([^\/]+)\/?/;
var userRe = /youtube\.com\/user\/([^\/]+)\/?/;
var rssRe = /(\/feed|rss|\.xml)/;
var nextcloudRe = /\/download\/?$/;


(function () {

   var ids = [];
   var videos = "";
   var key = "";
   var lines = [];
   var lastRefresh = null;
   var highlightNew = true;
   var hideOldCheck = true;
   var hideOldDays = 1;
   var hideFutureheck = true;
   var hideFutureHours = 2;
   var hideTimeCheck = true;
   var hideTimeMins = 20;
   var videoClickTarget = null;
   var nextcloudURL = null;

   $.ajaxSetup({
      cache: false
   });

   if (typeof (Storage) !== "undefined") {
      $("#apikey").val(localStorage.getItem("apikey"));
      highlightNew = localStorage.getItem("highlightNew") === 'false' ? false : true;
      $("#highlight_new").prop('checked', highlightNew);
      hideOldCheck = localStorage.getItem("hideOldCheck") === 'true' ? true : false;
      $("#hide_old_check").prop('checked', hideOldCheck);
      hideOldDays = Number(localStorage.getItem("hideOldDays"));
      if (hideOldDays > 0) {
         $("#hide_old_days").val(hideOldDays);
      }
      hideFutureCheck = localStorage.getItem("hideFutureCheck") === 'true' ? true : false;
      $("#hide_future_check").prop('checked', hideFutureCheck);
      hideFutureHours = Number(localStorage.getItem("hideFutureHours"));
      if (hideFutureHours > 0) {
         $("#hide_future_hours").val(hideFutureHours);
      }
      $("#hide_time_check").prop('checked', hideTimeCheck);
      hideTimeMins = Number(localStorage.getItem("hideTimeMins"));
      if (hideTimeMins > 0) {
         $("#hide_time_mins").val(hideTimeMins);
      }
      videoClickTarget = localStorage.getItem("videoClickTarget");
      $("#vc_target").val(videoClickTarget);
      nextcloudURL = localStorage.getItem("nextcloudURL");
      var linesStr = localStorage.getItem("lines");
      if (linesStr || nextcloudURL) {
         $("#nextcloud_url").val(nextcloudURL);
         $("#video_urls").val(linesStr);
         refresh();
      }
      // Don't put anything here - refresh() should happen last
   }

   key = $("#apikey").val();
   if (key == '') {
      $("#settings").slideDown();
   }

   $("body").on("click", ".close_channel", function () {
      $(this).closest(".channel").slideUp();
   });

   $("body").on("click", ".show_hidden", function () {
      $(this).closest(".channel").find(".would_hide").slideToggle(200);
   });

   $("#settings_button").click(function () {
      $("#settings").slideToggle(200);
   });

   $("#save_button").click(function () {
      refresh();
   });

   $("#videos").on("click", ".ribbon", function () {
      var href = $(this).closest(".video").find(".video_thumb > a").attr("href");
      location.href = href;
   });

   function errorBox(data) {
      window.scrollTo({
         top: 0,
         behavior: 'smooth'
      });
      var errMsg = 'Unknown error occured';
      if (typeof data == 'object' && 'responseJSON' in data) {
         $.each(data.responseJSON.error.errors, function (idx, val) {
            errMsg = val.reason + ', ' + val.message;
         });
      } else if (typeof data == 'string') {
         errMsg = data;
      }
      $("#error-box").text('Error: ' + errMsg).show();
      //return Promise.reject(errMsg);
   }

   function refresh() {
      $("#error-box").hide();
      key = $("#apikey").val();
      if (key == '') {
         errorBox('API key cannot be empty');
         return;
      }
      ids = [];
      var lines = '';
      nextcloudURL = $("#nextcloud_url").val();
      if (nextcloudURL != '') {
         // Append /download to get raw file
         if (nextcloudURL.match(nextcloudRe) === null) {
            nextcloudURL += "/download";
         }
         $.when($.get(nextcloudURL)).then(function (data) {
            lines = data.split(/\n/);
            let lines2 = $("#video_urls").val().split(/\n/);
            lines.push(...lines2);
            let uLines = new Set(lines); // Set is unique
            _refresh(Array.from(uLines));
         }, function (data) {
            errorBox('failed to fetch Nextcloud share link - check CORS headers')
         });
      } else {
         lines = $("#video_urls").val().split(/\n/);
         _refresh(lines);
      }
   }

   function _refresh(lines) {
      $("#videos").html('');

      if (typeof (Storage) !== "undefined") {
         var lr = moment(localStorage.getItem("lastRefresh"));
         if (lr) {
            lastRefresh = moment(lr);
         }
         localStorage.setItem("lines", $("#video_urls").val());
         localStorage.setItem("apikey", key);
         localStorage.setItem("lastRefresh", moment().toISOString());
         highlightNew = $("#highlight_new").is(":checked");
         localStorage.setItem("highlightNew", highlightNew);
         hideOldCheck = $("#hide_old_check").is(":checked");
         localStorage.setItem("hideOldCheck", hideOldCheck);
         hideOldDays = $("#hide_old_days").val();
         localStorage.setItem("hideOldDays", hideOldDays);
         hideFutureCheck = $("#hide_future_check").is(":checked");
         localStorage.setItem("hideFutureCheck", hideFutureCheck);
         hideFutureHours = $("#hide_future_hours").val();
         localStorage.setItem("hideFutureHours", hideFutureHours);
         hideTimeCheck = $("#hide_time_check").is(":checked");
         localStorage.setItem("hideTimeCheck", hideTimeCheck);
         hideTimeMins = $("#hide_time_mins").val();
         localStorage.setItem("hideTimeMins", hideTimeMins);
         videoClickTarget = $("#vc_target").val();
         localStorage.setItem("videoClickTarget", videoClickTarget);
         nextcloudURL = $("#nextcloud_url").val();
         localStorage.setItem("nextcloudURL", nextcloudURL);
      }

      $.when.apply($, lines.map(function (line) {
         if (line.trim() == "") {
            return;
         }
         $("#settings").slideUp();
         if (line.match(rssRe) !== null) {
            // Check if the line contains "feed"
            if (line.includes("feed")) {
               // Use the CORS proxy for URLs containing "feed"
               return $.get('https://proxy.sadankwt.com' + line).then(function (data) {
                  handleRSS(data);
               }, errorBox);
            } else {
               return $.get(line).then(function (data) {
                  handleRSS(data);
               }, errorBox);
            }
         } else {
            var url = apiChannelURL + "&key=" + key;
            var chanMatches = line.match(channelRe);
            var userMatches = line.match(userRe);
            var channelURL = 'https://www.youtube.com/';
            if (chanMatches && chanMatches.length > 1) {
               channelURL += 'channel/' + chanMatches[1];
               url += "&id=" + chanMatches[1];
            } else if (userMatches && userMatches.length > 1) {
               channelURL += 'user/' + userMatches[1];
               url += "&forUsername=" + userMatches[1];
            } else {
               id = line.trim();
               if (id.length == 24) {
                  url += "&id=" + id;
               } else {
                  url += "&forUsername=" + id;
               }
            }
            return $.get(url).then(handleChannel, errorBox).then(function (data) {
               handlePlaylist(channelURL, data);
            }, errorBox);
         }
      })).done(function () {
         getDurations();
         getLiveBroadcasts();
         setTimeout(function () {
            hiddenItemsStatus();
         }, 1000);
      });
   }


   function hiddenItemsStatus() {
      $(".channel").each(function () {
         var hiddenVids = false;
         $(this).find(".video_list .video").each(function () {
            if ($(this).css('display') === 'none') {
               $(this).addClass('would_hide');
               hiddenVids = true;
            }
         });

         if (hiddenVids) {
            var showHidden = $("<div class='show_hidden'><span class='glyphicon glyphicon-eye-open'></span></div>");
            $(this).find(".channel_title").append(showHidden);
         }
      });
   }

   function handleChannel(data) {
      if (typeof data === 'undefined' || typeof data.items === 'undefined') {
         return;
      }
      var playlistID = data.items[0].contentDetails.relatedPlaylists.uploads;
      url = apiPlaylistURL + "&key=" + key + "&playlistId=" + playlistID;
      return $.get(url);
   }

   function handlePlaylist(apiChannelURL, data) {
      if (typeof data === 'undefined' || typeof data.items === 'undefined') {
         return;
      }
      if (data.items.length == 0) {
         return;
      }
      data.items.sort(function (a, b) {
         return moment(a.snippet.publishedAt).isBefore(
            moment(b.snippet.publishedAt)
         );
      });
      videosOuter = "<div class='channel'>";
      var channelTitle = data.items[0].snippet.channelTitle;

      if (videoClickTarget.includes("piped")) {
         // Get the ChannelID from the API response
         var channelID = ""; // Initialize channelID variable
         if (data.items[0].snippet.channelId) {
            channelID = data.items[0].snippet.channelId;
         }

         // Construct the apiChannelURL for piped.video
         apiChannelURL = 'https://piped.video/channel/' + channelID + "/videos";
      } else if (videoClickTarget.includes("viewtube")) {
         // Get the ChannelID from the API response
         var channelID = ""; // Initialize channelID variable
         if (data.items[0].snippet.channelId) {
            channelID = data.items[0].snippet.channelId;
         }

         // Construct the apiChannelURL for viewtube.io
         apiChannelURL = 'https://viewtube.io/channel/' + channelID + "/videos";
      } else if (videoClickTarget.includes("incogtube")) {
         // Get the ChannelID from the API response
         var channelID = ""; // Initialize channelID variable
         if (data.items[0].snippet.channelId) {
            channelID = data.items[0].snippet.channelId;
         }

         // Construct the apiChannelURL for incogtube.com without /videos
         apiChannelURL = 'https://incogtube.com/channel?id=' + channelID;
         // Do not include /videos in the URL
      } else {
         // For all other cases, including when the videoClickTarget doesn't contain any of the above platforms
         // Construct the apiChannelURL with /videos at the end
         apiChannelURL = apiChannelURL + "/videos";
      }

      // Now construct the videosOuter
      videosOuter += "<div class='channel_title'><a href='" + apiChannelURL + "' target='_blank'>" + channelTitle + "</a>";


      videosOuter += "<div class='close_channel'><span class='glyphicon glyphicon-remove'></span></div>";
      videosOuter += "</div>";
      videosOuter += "<div class='video_list'>";
      videos = '';
      $.each(data.items, videoHTML);
      if (videos !== '') {
         videosOuter += videos;
      } else {
         videosOuter += "<i>no videos found</i>";
      }
      videosOuter += "</div>";
      videosOuter += "</div>";

      $("#videos").append(videosOuter);
   }


   function handleRSS(data) {
      if (data.length == 0) {
         return;
      }

      var $channel = $(data).find("channel");

      var channelTitle = $channel.find("title:first").text();
      var channelURL = $channel.find("link:first").text();
      var channelImageURL = $channel.find("image:first url").text();

      videosOuter = "<div class='channel'>";
      videosOuter += "<div class='channel_title'><a href='" + channelURL + "' target='_blank'>" + channelTitle + "</a>";
      videosOuter += "<div class='close_channel'><span class='glyphicon glyphicon-remove'></span></div>";
      videosOuter += "</div>";
      videosOuter += "<div class='video_list'>";
      videos = '';

      var rssVids = [];
      $channel.find("item").slice(0, 10).each(function () {
         $el = $(this);
         itemImageURL = $el.find("itunes\\:image").attr('href');
         if (itemImageURL == '') {
            itemImageURL = channelImageURL;
         }
         rssVids.push({
            "snippet": {
               "title": $el.find("title").text(),
               "resourceId": {
                  "videoId": $el.find("guid").text()
               },
               "thumbnails": {
                  "medium": {
                     "url": itemImageURL
                  }
               },
               "publishedAt": $el.find("pubDate").text(),
               "watchURL": $el.find("enclosure").attr('url'),
               "duration": $el.find("itunes\\:duration").text()
            }
         });
      });

      //console.log(rssVids);

      $.each(rssVids, videoHTML);
      if (videos !== '') {
         videosOuter += videos;
      } else {
         videosOuter += "<i>no videos found</i>";
      }
      videosOuter += "</div>";
      videosOuter += "</div>";

      $("#videos").append(videosOuter);
   }

   function getDurations() {
      // Filter out lexfridman.com URLs from the list of IDs
      var filteredIds = ids.filter(function (id) {
         return !id.includes("lexfridman.com");
      });

      // Construct the URL without lexfridman.com IDs
      var url = apiDurationURL + "&key=" + key + "&id=" + filteredIds.join(",");
      $.get(url, function (data) {
         $.each(data.items, function (k, v) {
            var duration = moment.duration(v.contentDetails.duration);
            var sec = ('00' + duration.seconds().toString()).substring(duration.seconds().toString().length);
            var min = ('00' + duration.minutes().toString()).substring(duration.minutes().toString().length);
            var durationStr = min + ":" + sec;
            if (duration.hours() > 0) {
               durationStr = duration.hours() + ":" + durationStr;
            }
            // Don't output duration if value already exists, e.g., if live broadcast
            if ($("#" + v.id + " .video_duration").text() !== "") {
               return;
            }
            $("#" + v.id + " .video_duration").text(durationStr);
            if (hideTimeCheck && duration.as('minutes') < hideTimeMins) {
               $("#" + v.id).hide();
               return;
            }
         });
      });
   }


   function getLiveBroadcasts() {
      // Filter out lexfridman.com URLs from the list of IDs
      var filteredIds = ids.filter(function (id) {
         return !id.includes("lexfridman.com");
      });

      // Construct the URL without lexfridman.com IDs
      var url = apiLiveBroadcastURL + "&key=" + key + "&id=" + filteredIds.join(",");
      $.get(url, function (data) {
         $.each(data.items, function (k, v) {
            if (v.snippet.liveBroadcastContent === "upcoming") {
               if (hideFutureCheck && moment().add(hideFutureHours, "hours").isBefore(moment(v.liveStreamingDetails.scheduledStartTime))) {
                  $("#" + v.id).hide();
               }
               $("#" + v.id + " .video_sched").text(moment(v.liveStreamingDetails.scheduledStartTime).fromNow()).show();
               $("#" + v.id + " .video_thumb img").addClass('grey-out');
            } else if (v.snippet.liveBroadcastContent === "live") {
               $("#" + v.id + " .video_duration").html("<div class='live'><span class='glyphicon glyphicon-record'></span> Live</div>");
            }
         });
      });
   }


   function videoHTML(k, v) {
      if (hideOldCheck && moment().subtract(hideOldDays, "days").isAfter(v.snippet.publishedAt)) {
         return;
      }

      let duration;
      // RSS durations here
      if ('duration' in v.snippet && v.snippet.duration !== "") {
         if (v.snippet.duration.indexOf(':') > -1) {
            if (v.snippet.duration.match(/^[0-9]{1,2}:[0-9]{1,2}$/)) {
               duration = moment.duration("00:" + v.snippet.duration);
            } else if (v.snippet.duration.match(/^[0-9]:[0-9]{1,2}:[0-9]{1,2}$/)) {
               duration = moment.duration("0" + v.snippet.duration);
            } else {
               duration = moment.duration(v.snippet.duration);
            }
         } else {
            duration = moment.duration(v.snippet.duration, 'seconds');
         }
         if (hideTimeCheck && duration.as('minutes') < hideTimeMins) {
            return;
         }
      }
      var fullTitle = v.snippet.title;
      var title = v.snippet.title;
      if (title.length > 50) {
         title = title.substring(0, 50) + "...";
      }

      var id = v.snippet.resourceId.videoId;
      ids.push(id);

      var div = "<div class='video' id='" + id + "'>"
      var watch = '';
      if ('watchURL' in v.snippet) {
         watch = v.snippet.watchURL;
      } else {
         watch = watchURL + "?v=" + id;
      }
      var clickURL = getClickURL(watch)
      div += "<div class='video_thumb'>";
      div += "<div class='video_sched'></div>";
      div += "<a href='" + clickURL + "' target='_blank'><img src='" + v.snippet.thumbnails.medium.url + "'></a>";
      div += "</div>";
      div += "<div class='video_title' title='" + fullTitle + "'>" + title + "</div>";
      if (duration) {
         div += "<div class='video_duration'>" + (duration.hours() > 0 ? duration.hours() + ":" : "") + pad(duration.minutes(), 2) + ":" + pad(duration.seconds(), 2) + "</div>";
      } else {
         div += "<div class='video_duration'></div>";
      }
      div += "<div class='video_footer'>" + moment(v.snippet.publishedAt).fromNow() + "</div>";
      if (lastRefresh && highlightNew && moment(lastRefresh).isBefore(v.snippet.publishedAt)) {
         div += "<div class='ribbon'><span>New</span></div>";
      }
      div += "</div>";

      videos += div;
   }

   function getClickURL(url) {
      if (videoClickTarget) {
         var v_index = url.indexOf("v=");
         var v_value = "";
         if (v_index !== -1) {
            v_value = url.substring(v_index + 2);
         }
         return videoClickTarget.replace("%v", encodeURIComponent(v_value));
      }
      return url;
   }

   function pad(n, width, z) {
      z = z || '0';
      n = n + '';
      return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
   }

   $("#pipedBtn").click(function (event) {
      event.preventDefault(); // Prevent the default behavior of the button
      // Set videoClickTarget input text for Piped
      $("#vc_target").val("https://piped.video/watch?v=%v");
   });

   $("#viewtubeBtn").click(function (event) {
      event.preventDefault(); // Prevent the default behavior of the button
      // Set videoClickTarget input text for Viewtube
      $("#vc_target").val("https://viewtube.io/watch?v=%v");
   });

   $("#incogtubeBtn").click(function (event) {
      event.preventDefault(); // Prevent the default behavior of the button
      // Set videoClickTarget input text for Incogtube
      $("#vc_target").val("https://incogtube.com/watch?v=%v");
   });

   $("#youtubeBtn").click(function (event) {
      event.preventDefault(); // Prevent the default behavior of the button
      // Set videoClickTarget input text for Incogtube
      $("#vc_target").attr("placeholder", "YouTube");
      $("#vc_target").val("");
   });

   $("#9xBtn").click(function (event) {
      event.preventDefault(); // Prevent the default behavior of the button
      // Set videoClickTarget input text for Incogtube
      $("#vc_target").attr("placeholder", "9x Player");
      $("#vc_target").val("");
   });


   // Export settings without page refresh
   $("#export_button").click(function (event) {
      event.preventDefault(); // Prevent default button behavior (page refresh)
      var settingsData = {
         apiKey: $("#apikey").val(),
         channelsAndUsers: $("#video_urls").val(),
         highlightNew: $("#highlight_new").is(":checked"),
         hideOldCheck: $("#hide_old_check").is(":checked"),
         hideOldDays: $("#hide_old_days").val(),
         hideFutureCheck: $("#hide_future_check").is(":checked"),
         hideFutureHours: $("#hide_future_hours").val(),
         hideTimeCheck: $("#hide_time_check").is(":checked"),
         hideTimeMins: $("#hide_time_mins").val(),
         videoClickTarget: $("#vc_target").val(),
         nextcloudURL: $("#nextcloud_url").val(),
         placeholderValue: $("#vc_target").attr("placeholder")
      };
      var settingsJSON = JSON.stringify(settingsData);
      var blob = new Blob([settingsJSON], {
         type: "application/json"
      });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "settings.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
   });

   // Trigger file input click event when "Import Settings" button is clicked
   $("#import_button_trigger").click(function () {
      $("#import_button").click();
   });

   // Prevent page refresh when the "Import Settings" button is clicked
   $("#import_button_trigger").click(function (event) {
      event.preventDefault();
   });

   // Import settings without page refresh
   $("#import_button").change(function (event) {
      var file = event.target.files[0];
      var reader = new FileReader();
      reader.onload = function (e) {
         var importedSettings = JSON.parse(e.target.result);
         $("#apikey").val(importedSettings.apiKey);
         $("#video_urls").val(importedSettings.channelsAndUsers);
         $("#highlight_new").prop('checked', importedSettings.highlightNew);
         $("#hide_old_check").prop('checked', importedSettings.hideOldCheck);
         $("#hide_old_days").val(importedSettings.hideOldDays);
         $("#hide_future_check").prop('checked', importedSettings.hideFutureCheck);
         $("#hide_future_hours").val(importedSettings.hideFutureHours);
         $("#hide_time_check").prop('checked', importedSettings.hideTimeCheck);
         $("#hide_time_mins").val(importedSettings.hideTimeMins);
         $("#vc_target").val(importedSettings.videoClickTarget);
         $("#nextcloud_url").val(importedSettings.nextcloudURL);
         $("#vc_target").attr("placeholder", importedSettings.placeholderValue);
         // Optionally, you can trigger an event to notify the user to save the settings
         // $("#save_button").click();
      };
      reader.readAsText(file);
   });


   // Slide up settings and prevent form submission when the "Clear Settings" button is clicked
   $("#clear_settings_button").click(function (event) {
      event.preventDefault(); // Prevent the default form submission behavior
      localStorage.clear(); // Clear localStorage

      // Clear the input fields by resetting their values to empty strings
      $("#apikey").val('');
      $("#video_urls").val('');
      // Add similar lines for other input fields if needed

      // Optionally, perform any additional actions here
   });


   // Function to open YouTube video in modal
   function openYoutubeModal(videoUrl) {
      // Get the YouTube video ID from the URL
      var videoId = videoUrl.split("v=")[1];

      // Construct the YouTube embed URL with autoplay parameter
      var embedUrl = "https://www.youtube.com/embed/" + videoId + "?autoplay=1&mute=1";

      // Create modal container
      var modalContainer = document.createElement("div");
      modalContainer.className = "modal-container";

      // Create iframe for embedded YouTube video
      var iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.width = "560";
      iframe.height = "315";
      iframe.allowFullscreen = true;
      iframe.setAttribute("frameborder", "0");

      // Append iframe to modal container
      modalContainer.appendChild(iframe);

      // Append modal container to body
      document.body.appendChild(modalContainer);

      // Prevent scrolling on the body while modal is open
      document.body.style.overflow = "hidden";

      // Close modal when clicking outside the iframe
      modalContainer.addEventListener("click", function (event) {
         if (event.target === modalContainer) {
            document.body.removeChild(modalContainer);
            document.body.style.overflow = ""; // Restore scrolling
         }
      });

      // Center the modal vertically and horizontally
      modalContainer.style.top = "50%";
      modalContainer.style.left = "50%";
      modalContainer.style.transform = "translate(-50%, -50%)";
   }

   // Function to open modal with 9xplayer
   function open9xPlayerModal(videoUrl) {
      // Encode the YouTube video URL to base64 and remove "=="
      var encodedUrl = btoa(videoUrl).replace(/==/g, '');

      // Create modal container
      var modalContainer = document.createElement("div");
      modalContainer.className = "modal-container";

      // Create iframe for 9xplayer with encoded YouTube URL
      var iframe = document.createElement("iframe");
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("scrolling", "no");
      iframe.setAttribute("allow", "autoplay;fullscreen");
      iframe.setAttribute("crossorigin", "anonymous");
      iframe.setAttribute("playsinline", "");
      iframe.style.position = "absolute";
      iframe.style.height = "60vh"; // Adjust height as needed
      iframe.style.width = "70vw"; // Adjust width as needed
      iframe.style.left = "50%";
      iframe.style.top = "50%";
      iframe.style.transform = "translate(-50%, -50%)";
      iframe.src = "https://9xplayer.com/?url=enc:" + encodedUrl + ",,&autoplay=true&encryption=true";

      // Append iframe to modal container
      modalContainer.appendChild(iframe);

      // Append modal container to body
      document.body.appendChild(modalContainer);

      // Prevent scrolling on the body while modal is open
      document.body.style.overflow = "hidden";

      // Close modal when clicking outside the iframe
      modalContainer.addEventListener("click", function (event) {
         if (event.target === modalContainer) {
            document.body.removeChild(modalContainer);
            document.body.style.overflow = ""; // Restore scrolling
         }
      });
   }


   // Function to open MP3 player modal
   function openMP3PlayerModal(mp3Url, videoTitle) {
      // Create modal container
      var modalContainer = document.createElement("div");
      modalContainer.className = "modal-container";

      // Create title element
      var title = document.createElement("h2");
      title.textContent = videoTitle; // Set the video title
      title.style.color = "white";
      title.style.fontSize = "1.2em"; // Adjust font size as needed
      title.style.marginBottom = "10px"; // Add margin to separate from audio tag

      // Create audio element for playing MP3
      var audio = document.createElement("audio");
      audio.src = mp3Url;
      audio.controls = true;

      // Create div for title and audio
      var contentDiv = document.createElement("div");
      contentDiv.style.display = "block";

      // Append title and audio elements to content div
      contentDiv.appendChild(title);
      contentDiv.appendChild(audio);

      // Append content div to modal container
      modalContainer.appendChild(contentDiv);

      // Append modal container to body
      document.body.appendChild(modalContainer);

      // Apply modal styles
      modalContainer.style.position = "fixed";
      modalContainer.style.top = "50%";
      modalContainer.style.left = "50%";
      modalContainer.style.transform = "translate(-50%, -50%)";
      modalContainer.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
      modalContainer.style.borderRadius = "10px";
      modalContainer.style.padding = "20px";
      modalContainer.style.width = "80%"; // Adjust width as needed
      modalContainer.style.maxWidth = "400px"; // Set maximum width
      modalContainer.style.textAlign = "center";
      modalContainer.style.maxHeight = "40%"; // Limit maximum height

      // Close modal when clicking outside the audio player
      document.addEventListener("click", function (event) {
         if (!modalContainer.contains(event.target)) {
            document.body.removeChild(modalContainer);
            document.body.style.overflow = ""; // Restore scrolling
            document.removeEventListener("click", arguments.callee);
         }
      });

      // Prevent scrolling on the body while modal is open
      document.body.style.overflow = "hidden";
   }

   // Function to retrieve video title based on the closest parent with a video ID
   function getVideoTitle(event) {
      var currentElement = event.target;
      while (currentElement) {
         if (currentElement.classList.contains("video")) {
            var videoTitleElement = currentElement.querySelector(".video_title");
            if (videoTitleElement) {
               return videoTitleElement.textContent.trim();
            }
         }
         currentElement = currentElement.parentElement;
      }
      return null;
   }

   // Attach click event listener to thumbnail anchor tags
   document.addEventListener("click", function (event) {
      // Check if the clicked element is a thumbnail anchor tag within a video_thumb container
      var isThumbnail = event.target.closest(".video_thumb > a");
      if (isThumbnail) {
         event.preventDefault(); // Prevent the default behavior of opening the link

         // Get the URL of the clicked thumbnail
         var videoClickURL = isThumbnail.href;

         // Get the video title associated with the clicked thumbnail
         var videoTitle = getVideoTitle(event);

         // Check if the URL contains ".mp3"
         if (videoClickURL.includes(".mp3")) {
            openMP3PlayerModal(videoClickURL, videoTitle); // Open the MP3 player modal with title
         } else {
            // Check the data-option attribute of the selected button
            var selectedOption = $("#vc_target").attr("placeholder");

            // If the selected option is 9x, open the 9x player modal
            if (selectedOption === "9x Player") {
               open9xPlayerModal(videoClickURL);
            } else {
               // Otherwise, open the default YouTube modal
               openYoutubeModal(videoClickURL);
            }
         }
      }
   });


}());
