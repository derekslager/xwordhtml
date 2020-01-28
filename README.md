# HTML5 Across Lite Reader

I wrote this HTML5 Across Lite reader over the course of a few
weekends in 2011. According to the [original
announcement](https://www.cruciverb.com/index.php?topic=1287.0), this
was the only way to render NY Times puzzles on Linux at the time. A
build of this code has been running at <http://derekslager.com/puz/>
since that time. Since then, the NY Times has added a first party
HTML-based crossword renderer and a mobile app, so today (in 2020)
it's mostly useful for independent puzzles that are exclusively
distributed in the Across Lite (puz) format.

This code has been sitting on a hard drive in the attic for several
years. I suspect it could be updated with minimal effort for modern
uses. The most obvious use case would be for embedding on independent
puzzle sites.

# Implementation Notes

The code was written in JavaScript using Google's [Closure
Library](https://github.com/google/closure-library), and is fully
optimized for the Google [Closure
Compiler](https://github.com/google/closure-compiler). When compiled
and served using gzip compression, the compiled code is less than 40
kilobytes over the network. A build file and sample scripts are
included for compiling using [Plovr](http://plovr.com/). It's been
about nine years since I last built the code, so I'd expect some
effort (or luck) would be required getting a fresh build.
