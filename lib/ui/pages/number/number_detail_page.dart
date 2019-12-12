import 'package:after_layout/after_layout.dart';
import 'package:dingn/blocs/number/bloc.dart';
import 'package:dingn/models/number_model.dart';
import 'package:dingn/themes.dart';
import 'package:dingn/ui/widgets/common/hyperlink.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dingn/blocs/bloc.dart';

const List<String> major_system_digits = [
  '0 - /s/, /z/',
  '1 - /t/, /d/',
  '2 - /n/',
  '3 - /m/',
  '4 - /r/',
  '5 - /l/',
  '6 - /tʃ/, /dʒ/, /ʃ/, /ʒ/',
  '7 - /k/, /ɡ/',
  '8 - /f/, /v/',
  '9 - /p/, /b/'
];
final String majorSystem = major_system_digits.join('  ');

class NumberDetailPage extends StatefulWidget {
  const NumberDetailPage({this.numbers, this.itemIndex});
  final List<Number> numbers;
  final int itemIndex;

  @override
  _NumberDetailState createState() => _NumberDetailState(numbers, itemIndex);
}


class _NumberDetailState extends State<NumberDetailPage> with TickerProviderStateMixin, AfterLayoutMixin{
  _NumberDetailState(this.numbers, this.itemIndex);
  final List<Number> numbers;
  final int itemIndex;

  void onBackClicked(){
    BlocProvider.of<PageBloc>(context).add(NavigateToPageEvent(const PageState(pageName:PageName.Number)));
  }

  void _redirectToAccountPage(){
    BlocProvider.of<PageBloc>(context).add(NavigateToPageEvent(PageState(pageName:PageName.Account, 
      items:[PageState(pageName: PageName.NumberDetail, items:numbers, itemIndex:itemIndex)], itemIndex:0)));
  }

  @override
  void afterFirstLayout(BuildContext context){
    _loadNumber(itemIndex);
  }

  void _loadNumber(int index){
    BlocProvider.of<NumberDetailBloc>(context).add(ShowDetailDataEvent(numbers, index));
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
        children: <Widget>[
          BlocListener<AuthenticationBloc, AuthenticationState>(
            listener: (BuildContext context, AuthenticationState state) {
              if (state is Unauthenticated)
                _redirectToAccountPage();
            },
            child: BlocBuilder<NumberDetailBloc, NumberDetailDataState>(
              builder: (BuildContext context, NumberDetailDataState state) {
                if (state.number != null && state.uid == null)
                  _redirectToAccountPage();
                if (state.number == null || state.uid == null)
                  return const Text('');
                final sortedWords = List<String>.from(state.number.words)..sort();
                final index = numbers.indexOf(state.number);
                return Center(
                  child: Container(
                    child: CustomScrollView(
                      slivers: <Widget>[
                        SliverAppBar(
                          pinned: true,
                          floating: true,
                          snap: false,
                          expandedHeight: 100.0,
                          backgroundColor: const Color.fromRGBO(0, 0, 0, 0.0),
                          flexibleSpace: FlexibleSpaceBar(
                            title: Tooltip(
                              message: majorSystem,
                              child: Text('${state.number.number}-${state.number.favoriteWord ?? ''}', style: const TextStyle(color:AppTheme.accentColor, fontSize: AppTheme.fontSizeMedium)),
                            ),
                            centerTitle: true,
                          ),
                          actions: <Widget>[
                            IconButton(
                              icon: const Icon(Icons.arrow_back),
                              tooltip: 'back to number page',
                              onPressed: onBackClicked,
                            ),
                            IconButton(
                              icon: const Icon(Icons.navigate_before),
                              tooltip: 'switch to previous number',
                              onPressed: index <= 0 ? null : ()=>_loadNumber(index - 1),
                            ),
                            IconButton(
                              icon: const Icon(Icons.navigate_next),
                              tooltip: 'switch to next number',
                              onPressed: index >= numbers.length - 1 ? null : ()=>_loadNumber(index + 1),
                            ),
                          ]                                                    
                        ),
                        if (state.number.number != null)
                          SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (BuildContext context, int index) {
                                return Center(
                                  child: ListTile(
                                    title: Text('${sortedWords[index]}'), 
                                    leading: IconButton(
                                      icon: Icon(Icons.favorite),
                                      color: state.number.myFavoriteWord == sortedWords[index] ? Colors.redAccent: Colors.grey,
                                      onPressed: (){
                                        if (sortedWords[index] != state.number.myFavoriteWord){
                                          BlocProvider.of<NumberDetailBloc>(context).add(SetFavoriteDataEvent(state.number, sortedWords[index]));
                                          BlocProvider.of<NumberBloc>(context).add(SetFavoriteDataEvent(state.number, sortedWords[index]));
                                        }
                                      },
                                    ),
                                    trailing: null,
                                    subtitle: Hyperlink(text:'https://en.wiktionary.org/wiki/${sortedWords[index]}', url:'https://en.wiktionary.org/wiki/${sortedWords[index]}')
                                  )
                                );
                              },
                              childCount: sortedWords.length,
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      );
  }
}


class HeaderWidget extends StatelessWidget {
  const HeaderWidget(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Text(text, style: Theme.of(context).textTheme.display1),
    );
  }
}

