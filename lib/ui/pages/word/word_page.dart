import 'package:after_layout/after_layout.dart';
import 'package:dingn/blocs/number/bloc.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dingn/blocs/bloc.dart';

final String majorSystem = major_system_digits.join('  ');

class WordPage extends StatefulWidget {
  @override
  _WordPageState createState() => _WordPageState();
}


class _WordPageState extends State<WordPage> with AfterLayoutMixin, TickerProviderStateMixin{

  // void _fetchData(){
  //   BlocProvider.of<NumberBloc>(context).add(FetchDataEvent());
  // }

  // void onAction(int digits){
  //   BlocProvider.of<NumberBloc>(context).add(ChangeDigitDataEvent(digits));
  // }

  @override
  void afterFirstLayout(BuildContext context){
    //_fetchData();
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthenticationBloc, AuthenticationState>(
            listener: (BuildContext context, AuthenticationState state) {
            },
            child: BlocBuilder<NumberBloc, NumberDataState>(
              builder: (BuildContext context, NumberDataState state) {
                return PageView.builder(
                    itemBuilder: (context, index){
                      return Container(
                        decoration: BoxDecoration(
                          border: Border.all(width: 1, color: Colors.redAccent),
                          borderRadius: const BorderRadius.all(Radius.circular(20))
                        ),
                      );
                    },
                    itemCount: 10,
                    physics: const ClampingScrollPhysics(),
                    
                );
              },
            ),
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

